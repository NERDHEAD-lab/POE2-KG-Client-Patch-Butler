import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { logger } from './logger.js';

/**
 * Creates a temporary batch script to replace the current executable with the new one.
 * @param newExePath Path to the newly downloaded executable (usually in temp)
 */
export const performSelfUpdate = (newExePath: string, updateType: 'installer' | 'portable') => {
    const currentExePath = process.execPath;
    const currentDir = path.dirname(currentExePath);
    // Ensure we are updating the actual exe, not node.exe during dev (though this is for packaged app)

    // Batch file path
    const batchPath = path.join(os.tmpdir(), `update_patch_butler_${Date.now()}.bat`);

    // Batch script content
    let batchContent = '';

    if (updateType === 'installer') {
        // Installer Mode: Run setup silently, then relaunch app
        batchContent = `
@echo off
timeout /t 2 /nobreak > NUL
start /wait "" "${newExePath}" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
start "" "${currentExePath}"
del "%~f0"
`;
    } else {
        // Portable Mode: Replace executable file directly
        batchContent = `
@echo off
timeout /t 2 /nobreak > NUL
move /y "${newExePath}" "${currentExePath}"
start "" "${currentExePath}"
del "%~f0"
`;
    }

    try {
        fs.writeFileSync(batchPath, batchContent, 'utf-8');

        // Spawn the batch script detached
        const child = spawn('cmd.exe', ['/c', batchPath], {
            detached: true,
            stdio: 'ignore',
            windowsVerbatimArguments: true
        });

        child.unref();

        // Exit immediately to allow the file to be overwritten
        process.exit(0);
    } catch (err) {
        logger.error('Failed to start self-update: ' + err);
        throw err;
    }
};
