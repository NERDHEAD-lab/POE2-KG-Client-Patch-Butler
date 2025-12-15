import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export function runPackCheck(installPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const exePath = path.join(installPath, 'PackCheck.exe');
        if (!fs.existsSync(exePath)) {
            return reject(new Error('PackCheck.exe not found'));
        }

        // Use 'start' to open in a new window.
        // /wait ensures we wait for it to close.
        // cmd /c "PackCheck.exe & pause" runs the check and waits for user input before closing.
        const child = spawn('cmd', ['/c', 'start', '"PackCheck Integrity Check"', '/wait', 'cmd', '/c', '"PackCheck.exe & pause"'], {
            cwd: installPath,
            stdio: 'ignore',
            windowsVerbatimArguments: true
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                // PackCheck might return non-zero on error
                resolve(); // Still resolve as we just want to run it
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}
