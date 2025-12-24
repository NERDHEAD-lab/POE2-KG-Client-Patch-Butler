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
import { getAppDataDirectory, getSilentModeEnabled } from './utils/config.js';
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
        const appDataDir = getAppDataDirectory();
        const binDir = path.join(appDataDir, 'bin');

        if (!fs.existsSync(binDir)) {
            fs.mkdirSync(binDir, { recursive: true });
        }

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
            action: () => {
                logger.info("Quitting via Tray...");
                process.exit(0);
            }
        });

        tray.setMenu(openItem, quitItem);
    } catch (e) {
        logger.error("Failed to initialize system tray: " + e);
    }
};

const triggerAlert = (): Promise<void> => {
    // Silent Mode Check
    if (getSilentModeEnabled()) {
        logger.info('Silent Mode: Auto-launching fix...');
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

        logger.info('Forcing alert for testing...');

        // Use spawn to avoid shell escaping issues and better handle execution
        const child = spawn('powershell', ['-Command', psScript], {
            windowsHide: true
        });

        child.on('close', (code: number) => {
            if (code === 0) {
                // Yes
                logger.info('User accepted fix. Launching Butler...');
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
                logger.info('User declined or error code: ' + code);
                resolve(); // Resolve anyway to continue watching
            }
        });

        child.on('error', (err: Error) => {
            logger.error('Failed to spawn alert: ' + err);
            reject(err);
        });
    });
};

export const startWatcher = async () => {
    logger.info('Starting POE2 Launcher Watcher...');
    await setupTray();

    let isRunning = false;
    let startTime: number | null = null;

    // Poll every 5 seconds
    setInterval(async () => {
        const currentlyRunning = await isProcessRunning('POE2_Launcher.exe');

        if (currentlyRunning && !isRunning) {
            // Process started
            logger.info('POE2_Launcher started.');
            isRunning = true;
            startTime = Date.now();
        } else if (!currentlyRunning && isRunning) {
            // Process ended
            logger.info('POE2_Launcher ended.');
            isRunning = false;

            if (startTime) {
                const duration = Date.now() - startTime;
                const minutes = duration / 1000 / 60;

                logger.info(`Duration: ${minutes.toFixed(2)} minutes`);
            }

            logger.info('Checking logs for potential errors...');
            // Check logs
            try {
                const logResult = await checkLogForErrors();
                if (logResult.hasError) {
                    logger.warn('Error detected in logs!');
                    // Trigger alert
                    await triggerAlert();
                } else {
                    logger.info('No error found in logs.');
                }
            } catch (e) {
                logger.error('Failed to check logs: ' + e);
            }
            startTime = null;
        }
    }, 5000);
};
