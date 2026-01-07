import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

export function runPackCheck(installPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const exePath = path.join(installPath, 'PackCheck.exe');
        if (!fs.existsSync(exePath)) {
            logger.error('PackCheck.exe를 찾을 수 없습니다: ' + exePath);
            return reject(new Error('PackCheck.exe not found'));
        }

        // 새 창에서 열기 위해 'start' 사용
        logger.info(`새 창에서 PackCheck를 실행합니다. 경로: ${installPath}`);
        const child = spawn('cmd', ['/c', 'start', '"PackCheck Integrity Check"', '/wait', 'cmd', '/c', '"PackCheck.exe & pause"'], {
            cwd: installPath,
            stdio: 'ignore',
            windowsVerbatimArguments: true
        });

        child.on('close', (code) => {
            if (code === 0) {
                logger.success('PackCheck가 성공적으로 완료되었습니다 (Code 0)');
                resolve();
            } else {
                // 에러 발생 시에도 진행
                logger.warn(`PackCheck가 종료되었습니다 (Code ${code})`);
                resolve();
            }
        });

        child.on('error', (err) => {
            logger.error('PackCheck 실행 실패: ' + err);
            reject(err);
        });
    });
}
