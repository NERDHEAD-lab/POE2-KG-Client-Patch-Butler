import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export function runPackCheck(installPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const exePath = path.join(installPath, 'PackCheck.exe');
        if (!fs.existsSync(exePath)) {
            return reject(new Error('PackCheck.exe not found'));
        }

        // 새 창에서 열기 위해 'start' 사용
        const child = spawn('cmd', ['/c', 'start', '"PackCheck Integrity Check"', '/wait', 'cmd', '/c', '"PackCheck.exe & pause"'], {
            cwd: installPath,
            stdio: 'ignore',
            windowsVerbatimArguments: true
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                // 에러 발생 시에도 진행
                resolve();
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}
