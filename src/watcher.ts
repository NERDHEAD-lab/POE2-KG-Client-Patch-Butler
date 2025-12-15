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

const triggerAlert = async () => {
    // PowerShell script to show Yes/No dialog
    const psScript = `
    Add-Type -AssemblyName PresentationCore,PresentationFramework
    $Result = [System.Windows.MessageBox]::Show('POE2 업데이트 실패가 감지되었습니다. 오류 해결 마법사를 진행 하겠습니까?', 'POE2 Patch Butler', 'YesNo', 'Warning')
    if ($Result -eq 'Yes') { exit 0 } else { exit 1 }
    `;

    try {
        await execAsync(`powershell -Command "${psScript}"`, { windowsHide: true });
        // If exit code 0 (Yes), run the fix
        console.log('User accepted fix. Launching Butler...');

        const exePath = process.execPath;
        // Spawn detached process
        const spawn = require('child_process').spawn;
        const child = spawn(exePath, ['--fix-patch'], {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();

    } catch (e) {
        // Exit code 1 (No) or error
        console.log('User declined or error:', e);
    }
};
