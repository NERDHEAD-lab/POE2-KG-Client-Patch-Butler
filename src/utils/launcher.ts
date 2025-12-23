import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

export function runPackCheck(installPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const exePath = path.join(installPath, 'PackCheck.exe');
        if (!fs.existsSync(exePath)) {
            logger.error('PackCheck.exe not found at: ' + exePath);
            return reject(new Error('PackCheck.exe not found'));
        }

        // 새 창에서 열기 위해 'start' 사용
        logger.info(`Launching PackCheck in new window. CWD: ${installPath}`);
        const child = spawn('cmd', ['/c', 'start', '"PackCheck Integrity Check"', '/wait', 'cmd', '/c', '"PackCheck.exe & pause"'], {
            cwd: installPath,
            stdio: 'ignore',
            windowsVerbatimArguments: true
        });

        child.on('close', (code) => {
            if (code === 0) {
                logger.success('PackCheck completed successfully (Code 0)');
                resolve();
            } else {
                // 에러 발생 시에도 진행
                logger.warn(`PackCheck completed with code ${code}`);
                resolve();
            }
        });

        child.on('error', (err) => {
            logger.error('Failed to spawn PackCheck: ' + err);
            reject(err);
        });
    });
}

export function launchWithArgs(commandLine: string): void {
    logger.info(`Relaunching game with command: ${commandLine}`);
    const child = spawn(commandLine, {
        detached: true,
        stdio: 'ignore',
        shell: true,
        windowsHide: false
    });
    child.unref();
}
