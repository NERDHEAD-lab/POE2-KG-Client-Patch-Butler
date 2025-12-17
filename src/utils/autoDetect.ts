import { exec, spawn } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

const REG_KEY_PATH = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const REG_VALUE_NAME = 'POE2_Patch_Butler_Watch';

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
    const command = `\\"${exePath}\\" --watch`;
    await execAsync(`reg add "${REG_KEY_PATH}" /v "${REG_VALUE_NAME}" /t REG_SZ /d "${command}" /f`);
};

export const disableAutoDetectRegistry = async (): Promise<void> => {
    try {
        await execAsync(`reg delete "${REG_KEY_PATH}" /v "${REG_VALUE_NAME}" /f`);
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
