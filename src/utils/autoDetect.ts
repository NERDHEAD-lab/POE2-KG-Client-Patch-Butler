import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

const REG_KEY_PATH = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const REG_VALUE_NAME = 'POE2_Patch_Butler_Watch';
const VBS_NAME = 'silent_launcher.vbs';

const generateSilentLauncher = (exePath: string) => {
    const vbsContent = `
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """${exePath}"" --watch", 0
Set WshShell = Nothing
    `.trim();

    // Use AppData to avoid permission issues in Program Files
    const appData = process.env.APPDATA || process.env.USERPROFILE || '.';
    const targetDir = path.join(appData, 'POE2PatchButler');

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const vbsPath = path.join(targetDir, VBS_NAME);
    fs.writeFileSync(vbsPath, vbsContent);
    return vbsPath;
};

export const isAutoDetectRegistryEnabled = async (): Promise<boolean> => {
    try {
        await execAsync(`reg query "${REG_KEY_PATH}" /v "${REG_VALUE_NAME}"`);
        return true;
    } catch {
        return false;
    }
};

export const enableAutoDetectRegistry = async (): Promise<void> => {
    const exePath = process.execPath;
    const vbsPath = generateSilentLauncher(exePath);

    // Use wscript.exe to run the VBScript
    const command = `wscript.exe \\"${vbsPath}\\"`;
    await execAsync(`reg add "${REG_KEY_PATH}" /v "${REG_VALUE_NAME}" /t REG_SZ /d "${command}" /f`);
};

export const disableAutoDetectRegistry = async (): Promise<void> => {
    try {
        await execAsync(`reg delete "${REG_KEY_PATH}" /v "${REG_VALUE_NAME}" /f`);

        // Clean up VBS file if it exists
        const appData = process.env.APPDATA || process.env.USERPROFILE || '.';
        const vbsPath = path.join(appData, 'POE2PatchButler', VBS_NAME);
        if (fs.existsSync(vbsPath)) {
            fs.unlinkSync(vbsPath);
        }
    } catch {
    }
};

export const stopWatcherProcess = async (): Promise<void> => {
    const currentExeName = path.basename(process.execPath);
    const psCommand = `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq '${currentExeName}' -and $_.CommandLine -like '*--watch*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;
    try {
        await execAsync(`powershell -Command "${psCommand}"`, { windowsHide: true });
    } catch (e) {
        console.error('Failed to stop watcher process:', e);
    }
};

export const startWatcherProcess = () => {
    const exePath = process.execPath;
    spawn(exePath, ['--watch'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
    }).unref();
};

export const restartWatcher = async () => {
    await stopWatcherProcess();
    startWatcherProcess();
};
