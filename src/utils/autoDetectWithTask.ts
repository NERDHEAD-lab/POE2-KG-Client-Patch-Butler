import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { logger } from './logger.js';
import { getAppDataDirectory, getConfigDirectory } from './config.js';
import os from 'os';

const execAsync = promisify(exec);
const TASK_NAME = 'POE2_Patch_Butler_Watch';
const VBS_NAME = 'silent_launcher.vbs';

const generateSilentLauncher = (exePath: string) => {
    // Reusing the same VBS logic to ensure hidden execution
    // We use robust quoting: ""path"" --watch
    const vbsContent = `
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """${exePath}""" & " --watch", 0
Set WshShell = Nothing
    `.trim();

    const targetDir = getConfigDirectory();
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    const vbsPath = path.join(targetDir, VBS_NAME);
    fs.writeFileSync(vbsPath, vbsContent, 'utf8');
    return vbsPath;
};

// Batch Helper to run commands as Admin via PowerShell (UAC)
const runAsAdminBatch = async (commands: string[]) => {
    const tempLog = path.join(os.tmpdir(), `poe2_task_${Date.now()}.log`);
    // Wrap commands to pipe output to temp file
    // & { cmd1; cmd2 } 2>&1 | Out-File ...
    const joined = commands.join('; ');
    const scriptBlock = `& { ${joined} } 2>&1 | Out-File -FilePath '${tempLog}' -Encoding UTF8`;

    // Encode scriptBlock
    const buffer = Buffer.from(scriptBlock, 'utf16le');
    const base64 = buffer.toString('base64');

    const psCommand = `Start-Process powershell -ArgumentList "-EncodedCommand ${base64}" -Verb RunAs -WindowStyle Hidden -Wait`;

    // Command shell escape
    const cmdSafe = psCommand.replace(/"/g, '\\"');

    try {
        await execAsync(`powershell -Command "${cmdSafe}"`, { windowsHide: true });

        if (fs.existsSync(tempLog)) {
            const output = fs.readFileSync(tempLog, 'utf8').trim();
            if (output) {
                logger.info('[Task Scheduler Output]:\n' + output);
            }
            fs.unlinkSync(tempLog);
        }
    } catch (e) {
        logger.error('Failed to run admin batch: ' + e);
    }
};

export const isAutoDetectTaskEnabled = async (): Promise<boolean> => {
    try {
        const { stdout } = await execAsync(`schtasks /Query /TN "${TASK_NAME}"`);
        return stdout.includes(TASK_NAME);
    } catch {
        return false;
    }
};

export const enableAutoDetectTask = async (): Promise<void> => {
    const exePath = process.execPath;
    const vbsPath = generateSilentLauncher(exePath);
    const safeVbsPath = vbsPath.replace(/'/g, "''"); // Escape for PS

    // Command: wscript //Nologo "C:\Path\To\File.vbs"
    // We pass this to /TR. In PowerShell, wrapping the whole /TR value in Single Quotes '...' is safest 
    // to preserve Double Quotes "..." inside.
    const taskCmd = `wscript //Nologo "${safeVbsPath}"`;

    const cmds: string[] = [];

    // 1. Kill existing watcher if valid (Consolidate UAC)
    try {
        const pidPath = path.join(getAppDataDirectory(), '.watcher_pid');
        if (fs.existsSync(pidPath)) {
            const pid = parseInt(fs.readFileSync(pidPath, 'utf8').trim());
            if (pid) {
                cmds.push(`try { Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue } catch {}`);
            }
        }
    } catch { }

    cmds.push(
        // Ensure Registry key is removed (Exclusive mode)
        `try { reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "POE2_Patch_Butler_Watch" /f } catch {}`,
        // Clean old task
        `try { schtasks /Delete /TN "${TASK_NAME}" /F } catch {}`,
        // Create new task
        `schtasks /Create /TN "${TASK_NAME}" /TR '${taskCmd}' /SC ONLOGON /RL HIGHEST /F`,
        // Run immediately
        `schtasks /Run /TN "${TASK_NAME}"`
    );

    await runAsAdminBatch(cmds);
};

export const disableAutoDetectTask = async (): Promise<void> => {
    const exeName = path.basename(process.execPath);
    // PowerShell command to find and kill watcher process
    const killCmd = `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq '${exeName}' -and $_.CommandLine -like '*--watch*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;

    const cmds = [
        `try { schtasks /Delete /TN "${TASK_NAME}" /F } catch {}`,
        killCmd
    ];

    await runAsAdminBatch(cmds);
};

export const isWatcherRunning = async (): Promise<boolean> => {
    try {
        const pidPath = path.join(getAppDataDirectory(), '.watcher_pid');
        if (!fs.existsSync(pidPath)) return false;

        const content = fs.readFileSync(pidPath, 'utf8').trim();
        const pid = parseInt(content);
        if (!pid) return false;

        try {
            process.kill(pid, 0); // Check existence
            return true;
        } catch (e: any) {
            return e.code === 'EPERM'; // Exists but Admin
        }
    } catch {
        return false;
    }
};

export const stopWatcherProcess = async (fallbackToAdmin: boolean = true): Promise<void> => {
    try {
        const pidPath = path.join(getAppDataDirectory(), '.watcher_pid');
        let pid = 0;
        if (fs.existsSync(pidPath)) {
            pid = parseInt(fs.readFileSync(pidPath, 'utf8').trim());
        }

        if (pid) {
            // Smart Stop: Try User-mode kill first
            try {
                process.kill(pid, 'SIGTERM');
                return;
            } catch (e: any) {
                if (e.code !== 'EPERM') {
                    return; // Process likely dead
                }
                // EPERM -> Admin process
            }

            if (fallbackToAdmin) {
                const killCmd = `Stop-Process -Id ${pid} -Force`;
                await runAsAdminBatch([killCmd]);
            }
        }
    } catch (e) {
        logger.error('Failed to stop watcher: ' + e);
    }
};

export const startWatcherProcessTask = async () => {
    if (await isAutoDetectTaskEnabled()) {
        try {
            await runAsAdminBatch([`schtasks /Run /TN "${TASK_NAME}"`]);
        } catch (e) {
            logger.error('Failed to run scheduled task: ' + e);
        }
    }
};

export const ensureWatcherRunningTask = async () => {
    if (await isAutoDetectTaskEnabled()) {
        const running = await isWatcherRunning();
        if (!running) {
            logger.info('Watcher task enabled but not running. Starting...');
            await startWatcherProcessTask();
        }
    }
};
