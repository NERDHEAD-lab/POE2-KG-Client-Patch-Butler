import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { getConfigDirectory } from './config.js';
import { logger } from './logger.js';

const execAsync = promisify(exec);

const REG_KEY_PATH = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const REG_VALUE_NAME = 'POE2_Patch_Butler_Watch';
const VBS_NAME = 'silent_launcher.vbs';

const generateSilentLauncher = (exePath: string) => {
    // VBScript to run the executable with --watch argument, hidden (0)
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

export const isAutoDetectRegistryEnabled = async (): Promise<boolean> => {
    try {
        await execAsync(`reg query "${REG_KEY_PATH}" /v "${REG_VALUE_NAME}"`);
        return true;
    } catch {
        return false;
    }
};

export const disableAutoDetectRegistry = async (): Promise<void> => {
    try {
        await execAsync(`reg delete "${REG_KEY_PATH}" /v "${REG_VALUE_NAME}" /f`);
    } catch {
        // Ignore if key doesn't exist
    }

    // Note: We do NOT delete the VBS file here to avoid recreation overhead if just toggling.
    // Migration logic handles cleanup of misplaced files.
};

export const enableAutoDetectRegistry = async (): Promise<void> => {
    // Cleanup any existing configuration first
    await disableAutoDetectRegistry();

    const exePath = process.execPath;
    const vbsPath = generateSilentLauncher(exePath);

    // Add VBS path to Registry Run key
    // We wrap path in quotes for registry value to handle spaces
    await execAsync(`reg add "${REG_KEY_PATH}" /v "${REG_VALUE_NAME}" /t REG_SZ /d "\"${vbsPath}\"" /f`);
};

export const startWatcherProcessRegistry = async () => {
    const vbsPath = path.join(getConfigDirectory(), VBS_NAME);
    if (fs.existsSync(vbsPath)) {
        // Execute VBS (wscript) detached
        const child = spawn('wscript', ['//Nologo', vbsPath], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });
        child.unref();
    } else {
        // Fallback or just re-enable?
        // If VBS is missing, we might need to recreate it.
        // For now, try enabling first?
        try {
            await enableAutoDetectRegistry();
            const child = spawn('wscript', ['//Nologo', vbsPath], {
                detached: true,
                stdio: 'ignore',
                windowsHide: true
            });
            child.unref();
        } catch (e) {
            logger.error('Failed to start registry watcher: ' + e);
        }
    }
};
