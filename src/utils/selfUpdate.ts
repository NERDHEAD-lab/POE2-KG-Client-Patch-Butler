import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

/**
 * Creates a temporary batch script to replace the current executable with the new one.
 * @param newExePath Path to the newly downloaded executable (usually in temp)
 */
export const performSelfUpdate = (newExePath: string) => {
    const currentExePath = process.execPath;
    const currentDir = path.dirname(currentExePath);
    // Ensure we are updating the actual exe, not node.exe during dev (though this is for packaged app)

    // Batch file path
    // Batch file path
    const batchPath = path.join(os.tmpdir(), `update_patch_butler_${Date.now()}.bat`);

    // Batch script content
    // 1. Wait for current process to exit (timeout)
    // 2. Move new exe to current exe location (overwrite)
    // 3. Start the new exe
    // 4. Delete the batch file itself
    const batchContent = `
@echo off
timeout /t 2 /nobreak > NUL
move /y "${newExePath}" "${currentExePath}"
start "" "${currentExePath}"
del "%~f0"
`;

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
        console.error('Failed to start self-update:', err);
        throw err;
    }
};
