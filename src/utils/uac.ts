import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { logger } from './logger.js';
import { getBinDirectory, getLogsDirectory } from './config.js';

const PROTOCOL_KEY = join('HKCR', 'daumgamestarter', 'shell', 'open', 'command');
const BACKUP_KEY_PATH = join('HKCU', 'Software', 'DaumGames', 'POE2', 'Backup');
const BACKUP_VALUE_NAME = 'OriginalStarterCommand';
const TASK_NAME = 'SkipDaumGameStarterUAC';

/**
 * Executes a PowerShell command with Admin privileges (RunAs).
 */
async function runPowerShellAsAdmin(psCommand: string): Promise<boolean> {
    const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
    const wrapper = `Start-Process powershell -Verb RunAs -ArgumentList "-EncodedCommand ${encodedCommand}" -WindowStyle Hidden -Wait`;
    
    return new Promise((resolve) => {
        const child = spawn('powershell', ['-Command', wrapper], { windowsHide: true });
        
        child.on('exit', (code) => {
            if (code === 0) {
                resolve(true);
            } else {
                logger.error(`PowerShell execution failed with code: ${code}`);
                resolve(false);
            }
        });

        child.on('error', (err) => {
            logger.error(`PowerShell execution error: ${err.message}`);
            resolve(false);
        });
    });
}

/**
 * Reads the current command from the registry.
 */
function getCurrentCommand(): Promise<string | null> {
    return new Promise((resolve) => {
        const child = spawn('reg', ['query', PROTOCOL_KEY, '/ve'], { windowsHide: true });
        let output = '';

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            if (code !== 0) {
                resolve(null); 
                return;
            }
            const match = output.match(/REG_SZ\s+(.*)/);
            if (match && match[1]) {
                resolve(match[1].trim());
            } else {
                resolve(null);
            }
        });
    });
}

/**
 * Checks if the bypass is currently applied.
 * It checks if our proxy script is present in the command.
 */
export async function isUACBypassEnabled(): Promise<boolean> {
    const cmd = await getCurrentCommand();
    if (!cmd) return false;
    return cmd.toLowerCase().includes('bypass_proxy.bat');
}

/**
 * Enables the UAC Bypass (Task Scheduler Method).
 * 1. Create 'runner.ps1': Reads args from file and starts DaumGameStarter.
 * 2. Create 'bypass_proxy.bat': Writes args to file and triggers Task.
 * 3. Create Scheduled Task: Runs runner.ps1 with Highest Privileges.
 * 4. Update Registry: Point to bypass_proxy.bat.
 */
export async function enableUACBypass(): Promise<boolean> {
    const currentCmd = await getCurrentCommand();
    if (!currentCmd) {
        logger.error('Failed to read current daumgamestarter protocol command.');
        return false;
    }

    if (currentCmd.includes('bypass_proxy.bat')) {
        logger.info('UAC Bypass is already active.');
        return true;
    }

    const binDir = getBinDirectory();
    const logsDir = getLogsDirectory();
    
    const proxyBatPath = join(binDir, 'bypass_proxy.bat');
    const runnerPs1Path = join(binDir, 'runner.ps1');
    const argsFilePath = join(binDir, 'launch_args.txt');
    const debugLogPath = join(logsDir, 'uac_debug.log');

    const daumStarterForScript = extractExePath(currentCmd);
    if (!daumStarterForScript) {
        logger.error(`Failed to extract valid executable path from: ${currentCmd}`);
        return false;
    }

    // 1. Create runner.ps1
    // Reads arguments from file and launches the actual starter
    const runnerScriptContent = `
$ErrorActionPreference = "Stop"
try {
    $argsContent = Get-Content "${argsFilePath}" -Raw
    # Remove potential surrounding quotes from the argument if doubling occurs, though usually it's just the URL
    $arg = $argsContent.Trim()
    
    "$(Get-Date): [Runner] Starting..." | Out-File -FilePath "${debugLogPath}" -Append -Encoding utf8
    "$(Get-Date): [Runner] Target Exe: ${daumStarterForScript}" | Out-File -FilePath "${debugLogPath}" -Append -Encoding utf8
    "$(Get-Date): [Runner] Read arg: $arg" | Out-File -FilePath "${debugLogPath}" -Append -Encoding utf8

    $process = Start-Process -FilePath "${daumStarterForScript}" -ArgumentList $arg -PassThru
    "$(Get-Date): [Runner] Process Started: ID $($process.Id)" | Out-File -FilePath "${debugLogPath}" -Append -Encoding utf8
} catch {
    "$(Get-Date): [Runner] Error: $_" | Out-File -FilePath "${debugLogPath}" -Append -Encoding utf8
    exit 1
}
`;
    try {
        writeFileSync(runnerPs1Path, runnerScriptContent, { encoding: 'utf8' });
    } catch (e: any) {
        logger.error(`Failed to create runner script: ${e.message}`);
        return false;
    }

    // 2. Create bypass_proxy.bat
    // Saves the argument (%1) to file and runs the task
    // Note: %* captures all args, but protocol usually gives just one.
    // Use > to overwrite the log file at the start of proxy execution.
    // Use chcp 65001 to ensure UTF-8 encoding for Batch echo and redirected output.
    const proxyScriptContent = `
@echo off
chcp 65001 > nul
echo [%date% %time%] [Proxy] Received args: %* > "${debugLogPath}"
echo %* > "${argsFilePath}"
echo [%date% %time%] [Proxy] Triggering Task: ${TASK_NAME} >> "${debugLogPath}"
schtasks /run /tn "${TASK_NAME}" >> "${debugLogPath}" 2>&1
`;
    try {
        writeFileSync(proxyBatPath, proxyScriptContent, { encoding: 'utf8' });
    } catch (e: any) {
        logger.error(`Failed to create proxy script: ${e.message}`);
        return false;
    }

    // 3. Backup Registry
    await new Promise((resolve) => {
        const args = ['add', BACKUP_KEY_PATH, '/v', BACKUP_VALUE_NAME, '/t', 'REG_SZ', '/d', currentCmd, '/f'];
        const child = spawn('reg', args, { windowsHide: true });
        child.on('close', resolve);
    });

    // 4. Create Scheduled Task (Admin)
    // Runs runner.ps1 via PowerShell
    const taskAction = `powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "${runnerPs1Path}"`;
    // We create the task with /SC ONCE /ST 00:00 (dummy trigger) but /RL HIGHEST is key.
    // Actually /SC ONCE requires a time. 00:00 might be in the past, effectively "on demand".
    // Alternatively, just /SC MONTHLY. It doesn't matter much as we trigger it manually.
    // Important: 'schtasks /create /tn ... /tr ... /sc ONCE /st 00:00 /rl HIGHEST /f'
    
    // NOTE: We use Start-Process to run schtasks as Admin
    // Command: schtasks /create /tn "SkipDaumGameStarterUAC" /tr "..." /sc ONCE /st 00:00 /rl HIGHEST /f
    // We need to escape quotes for the /tr argument carefully.
    // The TR is: powershell ... -File "C:\...\runner.ps1"
    
    const schCommand = `schtasks /create /tn "${TASK_NAME}" /tr "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File '${runnerPs1Path}'" /sc ONCE /st 00:00 /rl HIGHEST /f`;
    
    logger.info('Creating Scheduled Task with Highest Level privileges...');
    const taskResult = await runPowerShellAsAdmin(schCommand);
    if (!taskResult) return false;

    // 5. Update Registry to point to proxy bat
    const newCmd = `"${proxyBatPath}" "%1"`;
    // Escape for PowerShell script string
    const regPsScript = `Set-Item -Path "Registry::${PROTOCOL_KEY}" -Value '${newCmd}'`;
    
    logger.info('Updating Registry to use Proxy Script...');
    const regResult = await runPowerShellAsAdmin(regPsScript);

    if (regResult) {
        logger.success('UAC Bypass (Scheduler Method) applied successfully.');
    } else {
        logger.error('Failed to update registry.');
    }
    
    return regResult;
}

/**
 * Disables the UAC Bypass.
 * 1. Restore Registry.
 * 2. Delete Scheduled Task.
 * 3. Delete generated scripts.
 */
export async function disableUACBypass(): Promise<boolean> {
    // 1. Read Backup
    const backupCmd = await new Promise<string | null>((resolve) => {
        const child = spawn('reg', ['query', BACKUP_KEY_PATH, '/v', BACKUP_VALUE_NAME], { windowsHide: true });
        let out = '';
        child.stdout.on('data', d => out += d);
        child.on('close', (code) => {
            if (code !== 0) { resolve(null); return; }
            const match = out.match(/REG_SZ\s+(.*)/);
            resolve(match ? match[1].trim() : null);
        });
    });

    if (!backupCmd) {
        logger.error('No backup found. Cannot restore safely.');
        return false;
    }

    if (backupCmd.includes('bypass_proxy.bat')) {
        logger.warn('Backup seems modified. Skipping restore.');
        return false; 
    }

    // 2. Restore Registry
    const psScript = `Set-Item -Path "Registry::${PROTOCOL_KEY}" -Value '${backupCmd}'`;
    logger.info('Restoring Registry...');
    const regResult = await runPowerShellAsAdmin(psScript);

    if (!regResult) {
        logger.error('Failed to restore registry.');
        return false;
    }

    // 3. Delete Scheduled Task
    logger.info('Deleting Scheduled Task...');
    await runPowerShellAsAdmin(`schtasks /delete /tn "${TASK_NAME}" /f`);

    // 4. Cleanup Files
    const binDir = getBinDirectory();
    const logsDir = getLogsDirectory();
    try {
        const binFiles = ['bypass_proxy.bat', 'runner.ps1', 'launch_args.txt'];
        binFiles.forEach(f => {
            const p = join(binDir, f);
            if (existsSync(p)) unlinkSync(p);
        });

        const logPath = join(logsDir, 'uac_debug.log');
        if (existsSync(logPath)) unlinkSync(logPath);

        logger.success('Cleanup complete. UAC Bypass disabled.');
    } catch (e: any) {
        logger.warn(`Cleanup partial error: ${e.message}`);
    }

    return true;
}

/**
 * Helper to extract executable path from a command string.
 */
function extractExePath(cmd: string): string | null {
    let exePath = '';
    
    if (cmd.startsWith('"')) {
        const nextQuote = cmd.indexOf('"', 1);
        if (nextQuote !== -1) {
            exePath = cmd.substring(1, nextQuote);
        }
    } else {
        const firstSpace = cmd.indexOf(' ');
        exePath = firstSpace >= 0 ? cmd.substring(0, firstSpace) : cmd;
    }

    if (exePath && exePath !== '%1' && exePath.toLowerCase().endsWith('.exe')) {
        return exePath;
    }

    // Second attempt: search for something ending in .exe before %1
    const exeMatch = cmd.match(/([A-Z]:\\[^"]+\.exe)/i);
    return exeMatch ? exeMatch[1] : null;
}
