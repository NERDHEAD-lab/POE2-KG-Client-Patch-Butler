import { spawn } from 'child_process';
import os from 'os';
import { isProcessRunning } from './utils/process.js';
import { checkLogForErrors } from './utils/logParser.js';
import fs from 'fs';
import path from 'path';
// Use local consolidated Tray implementation
import Tray from './utils/tray.js';
import { ICON_BASE64 } from './generated/iconBase64.js';
import { TRAY_APP_BASE64 } from './generated/trayAppBase64.js';
import { getSilentModeEnabled, getBinDirectory } from './utils/config.js';
import { logger } from './utils/logger.js';

// Keep tray in global scope to prevent garbage collection
let tray: any = null;

const openOrFocusApp = () => {
    const newApp = spawn('cmd', ['/c', 'start', 'POE2 Patch Butler', process.execPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false
    });
    newApp.unref();
};

const setupTray = async () => {
    try {
        const binDir = getBinDirectory();

        const iconPath = path.join(binDir, 'icon.ico');
        const trayAppPath = path.join(binDir, 'trayicon.exe');

        // Always write the icon to ensure it exists
        fs.writeFileSync(iconPath, Buffer.from(ICON_BASE64, 'base64'));

        // Always write the tray binary to ensure it exists
        fs.writeFileSync(trayAppPath, Buffer.from(TRAY_APP_BASE64, 'base64'));

        tray = await Tray.create({
            title: 'POE2 Patch Butler',
            icon: fs.readFileSync(iconPath),
            useTempDir: true, // Important for pkg/sea execution
            trayAppPath: trayAppPath, // Pass the custom path to our local lib
            action: () => openOrFocusApp() // Click action
        });

        const openItem = await tray.item("열기 (Open)", {
            action: () => openOrFocusApp()
        });

        const quitItem = await tray.item("종료 (Quit)", {
            action: async () => {
                logger.info("트레이 아이콘을 통해 종료합니다...");
                try {
                    const { stopServer } = await import('./utils/server.js');
                    stopServer();
                } catch (e) { }
                process.exit(0);
            }
        });

        tray.setMenu(openItem, quitItem);
    } catch (e) {
        logger.error("시스템 트레이 초기화 실패: " + e);
    }
};

const triggerAlert = (): Promise<void> => {
    // Silent Mode Check
    if (getSilentModeEnabled()) {
        logger.info('무음 모드: 수정 마법사를 자동으로 실행합니다...');
        const exePath = process.execPath;
        const startArgs = ['/c', 'start', 'POE2 Patch Butler', exePath, '--fix-patch'];
        const fixChild = spawn('cmd', startArgs, {
            detached: true,
            stdio: 'ignore',
            windowsHide: false
        });
        fixChild.unref();
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        // PowerShell script to show Yes/No dialog
        const psScript = "Add-Type -AssemblyName PresentationCore,PresentationFramework; $Result = [System.Windows.MessageBox]::Show('POE2 업데이트 실패가 감지되었습니다. 오류 해결 마법사를 진행 하겠습니까?', 'POE2 Patch Butler', 'YesNo', 'Warning', [System.Windows.MessageBoxResult]::No, [System.Windows.MessageBoxOptions]::DefaultDesktopOnly); if ($Result -eq 'Yes') { exit 0 } else { exit 1 }";

        logger.info('테스트를 위해 강제 알림을 발생시킵니다...');

        // Use spawn to avoid shell escaping issues and better handle execution
        const child = spawn('powershell', ['-Command', psScript], {
            windowsHide: true
        });

        child.on('close', (code: number) => {
            if (code === 0) {
                // Yes
                logger.info('사용자가 수정을 승인했습니다. 툴을 실행합니다...');
                const exePath = process.execPath;
                // Use 'start' command to ensure a new console window is created
                const startArgs = ['/c', 'start', 'POE2 Patch Butler', exePath, '--fix-patch'];

                const fixChild = spawn('cmd', startArgs, {
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: false
                });
                fixChild.unref();
                resolve();
            } else {
                // No or error
                logger.info('사용자가 거절했거나 오류 코드 발생: ' + code);
                resolve(); // Resolve anyway to continue watching
            }
        });

        child.on('error', (err: Error) => {
            logger.error('알림 창 생성 실패: ' + err);
            reject(err);
        });
    });
};

export const startWatcher = async () => {
    logger.info('POE2 런처 감시자를 시작합니다...');
    await setupTray();

    let isRunning = false;
    let startTime: number | null = null;

    const runCheck = async () => {
        try {
            const currentlyRunning = await isProcessRunning('POE2_Launcher.exe');

            if (currentlyRunning && !isRunning) {
                // Process started
                logger.info('POE2 런처가 시작되었습니다.');
                isRunning = true;
                startTime = Date.now();
            } else if (!currentlyRunning && isRunning) {
                // Process ended
                logger.info('POE2 런처가 종료되었습니다.');
                isRunning = false;

                if (startTime) {
                    const duration = Date.now() - startTime;
                    const minutes = duration / 1000 / 60;

                    logger.info(`실행 시간: ${minutes.toFixed(2)} 분`);
                }

                logger.info('오류 발생 여부를 확인하기 위해 로그를 검사합니다...');
                // Check logs
                try {
                    const logResult = await checkLogForErrors();
                    if (logResult.hasError) {
                        logger.warn('로그에서 오류가 감지되었습니다!');
                        // Trigger alert
                        await triggerAlert();
                    } else {
                        logger.info('로그에서 오류가 발견되지 않았습니다.');
                    }
                } catch (e) {
                    logger.error('로그 검사 실패: ' + e);
                }
                startTime = null;
            }
        } catch (e) {
            logger.error('감시자 루프 오류: ' + e);
        } finally {
            // Schedule next check
            setTimeout(runCheck, 5000);
        }
    };

    // Start loop
    runCheck();
};
