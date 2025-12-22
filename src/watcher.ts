import { spawn } from 'child_process';
import { isProcessRunning } from './utils/process.js';
import { checkLogForErrors } from './utils/logParser.js';
import fs from 'fs';
import path from 'path';
// Use local consolidated Tray implementation
import Tray from './utils/tray.js';
import { ICON_BASE64 } from './generated/iconBase64.js';
import { TRAY_APP_BASE64 } from './generated/trayAppBase64.js';
import { getAppDataDirectory } from './utils/config.js';

// Keep tray in global scope to prevent garbage collection
let tray: any = null;

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
            trayAppPath: trayAppPath // Pass the custom path to our local lib
        });

        const item = await tray.item("종료 (Quit)", {
            action: () => {
                console.log("Quitting via Tray...");
                process.exit(0);
            }
        });

        tray.setMenu(item);
    } catch (e) {
        console.error("Failed to initialize system tray:", e);
    }
};

export const startWatcher = async () => {
    console.log('Starting POE2 Launcher Watcher...');
    await setupTray();

    let isRunning = false;
    let startTime: number | null = null;

    // Poll every 5 seconds
    setInterval(async () => {
        const currentlyRunning = await isProcessRunning('POE2_Launcher.exe');

        if (currentlyRunning && !isRunning) {
            // Process started
            console.log('POE2_Launcher started.');
            isRunning = true;
            startTime = Date.now();
        } else if (!currentlyRunning && isRunning) {
            // Process ended
            console.log('POE2_Launcher ended.');
            isRunning = false;

            if (startTime) {
                const duration = Date.now() - startTime;
                const minutes = duration / 1000 / 60;

                console.log(`Duration: ${minutes.toFixed(2)} minutes`);

                if (minutes < 5) {
                    console.log('Short session detected. Checking logs...');
                    // Check logs
                    try {
                        const logResult = await checkLogForErrors();
                        if (logResult.hasError) {
                            console.log('Error detected in logs!');
                            // Trigger alert
                            await triggerAlert();
                        } else {
                            console.log('No error found in logs.');
                        }
                    } catch (e) {
                        console.error('Failed to check logs:', e);
                    }
                }
            }
            startTime = null;
        }
    }, 5000);
};

const triggerAlert = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        // PowerShell script to show Yes/No dialog
        const psScript = "Add-Type -AssemblyName PresentationCore,PresentationFramework; $Result = [System.Windows.MessageBox]::Show('POE2 업데이트 실패가 감지되었습니다. 오류 해결 마법사를 진행 하겠습니까?', 'POE2 Patch Butler', 'YesNo', 'Warning', [System.Windows.MessageBoxResult]::No, [System.Windows.MessageBoxOptions]::DefaultDesktopOnly); if ($Result -eq 'Yes') { exit 0 } else { exit 1 }";

        console.log('Forcing alert for testing...');

        // Use spawn to avoid shell escaping issues and better handle execution
        const child = spawn('powershell', ['-Command', psScript], {
            windowsHide: true
        });

        child.on('close', (code: number) => {
            if (code === 0) {
                // Yes
                console.log('User accepted fix. Launching Butler...');
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
                console.log('User declined or error code:', code);
                resolve(); // Resolve anyway to continue watching
            }
        });

        child.on('error', (err: Error) => {
            console.error('Failed to spawn alert:', err);
            reject(err);
        });
    });
};
