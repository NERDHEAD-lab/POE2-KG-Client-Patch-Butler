import { exec } from 'child_process';
import { promisify } from 'util';
import { isProcessRunning } from './utils/process.js';
import { checkLogForErrors } from './utils/logParser.js';
import path from 'path';

const execAsync = promisify(exec);

export const startWatcher = async () => {
    console.log('Starting POE2 Launcher Watcher...');

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
        const psScript = "Add-Type -AssemblyName PresentationCore,PresentationFramework; $Result = [System.Windows.MessageBox]::Show('POE2 업데이트 실패가 감지되었습니다. 오류 해결 마법사를 진행 하겠습니까?', 'POE2 Patch Butler', 'YesNo', 'Warning'); if ($Result -eq 'Yes') { exit 0 } else { exit 1 }";

        console.log('Forcing alert for testing...');

        // Use spawn to avoid shell escaping issues and better handle execution
        const { spawn } = require('child_process');
        const child = spawn('powershell', ['-Command', psScript], {
            windowsHide: true
        });

        child.on('close', (code: number) => {
            if (code === 0) {
                // Yes
                console.log('User accepted fix. Launching Butler...');
                const exePath = process.execPath;
                // Use 'start' command to ensure a new console window is created
                const { spawn } = require('child_process');
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
