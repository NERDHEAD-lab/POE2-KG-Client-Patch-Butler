import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { logger } from './logger.js';

const execAsync = promisify(exec);

/**
 * Checks for single instance compatibility.
 * @param isFixPatch If true, this instance is a "Fix Patch" wizard (High Priority). It should close other instances.
 * @returns Promise<boolean> - true if this instance should start, false if it should exit.
 */
import { getAppDataDirectory } from './config.js';

export const checkSingleInstance = async (isFixPatch: boolean): Promise<boolean> => {
    let tempScriptPath = '';
    try {
        const currentPid = process.pid;
        const currentExeName = path.basename(process.execPath);

        // Read Watcher PID if exists
        let watcherPid = 0;
        try {
            const pidPath = path.join(getAppDataDirectory(), '.watcher_pid');
            if (fs.existsSync(pidPath)) {
                watcherPid = parseInt(fs.readFileSync(pidPath, 'utf8').trim()) || 0;
            }
        } catch { }

        // Create temp script path
        tempScriptPath = path.join(os.tmpdir(), `poe2_check_${Date.now()}.ps1`);

        // PowerShell script
        const psScript = `
            $ErrorActionPreference = 'Stop'
            try {
                $currentPid = ${currentPid}
                $watcherPid = ${watcherPid}
                $procName = '${currentExeName}'
                $isFixPatch = ${isFixPatch ? '$true' : '$false'}
                
                # Find candidates: Same name, Not me, Not watcher
                $candidates = Get-CimInstance Win32_Process | Where-Object { 
                    $_.Name -eq $procName -and 
                    $_.ProcessId -ne $currentPid -and 
                    $_.ProcessId -ne $watcherPid
                }
                
                # Filter: Must NOT have --watch (for non-admin processes where we CAN read CLI)
                # If CLI is null (Admin), we assume it's a GUI UNLESS it was the watcherPid (already excluded above).
                $guiProcs = $candidates | Where-Object { 
                   $cmd = $_.CommandLine
                   if ($null -eq $cmd) { $true } else { $cmd -notlike '*--watch*' }
                }
                
                # Safety for dev mode (node.exe)
                if ($procName -eq 'node.exe') {
                     $guiProcs = $guiProcs | Where-Object { $_.CommandLine -like '*cli.js*' -or $_.CommandLine -like '*poe2-patch-butler*' }
                }

                if ($isFixPatch) {
                    # Fix Patch Mode: Close others, then run self
                    if ($guiProcs) {
                        $guiProcs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
                    }
                    Write-Output "CONTINUE"
                } else {
                    # Normal Mode: If others exist, Focus first one and Exit self
                    if ($guiProcs) {
                         $first = $guiProcs | Select-Object -First 1
                         $pidToFocus = $first.ProcessId
                         
                         $wshell = New-Object -ComObject WScript.Shell
                         $success = $wshell.AppActivate($pidToFocus)
                         
                         # Alert user
                         Add-Type -AssemblyName System.Windows.Forms
                         [System.Windows.Forms.MessageBox]::Show('POE2 Patch Butler가 이미 실행 중입니다.', '알림', 'OK', 'Information')
                         
                         Write-Output "FOUND_AND_FOCUSED"
                     } else {
                         Write-Output "CONTINUE"
                     }
                }
            } catch {
                Write-Error $_
            }
        `;

        fs.writeFileSync(tempScriptPath, '\uFEFF' + psScript, { encoding: 'utf8' });

        const { stdout } = await execAsync(`powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`, { windowsHide: true });

        if (stdout.includes('FOUND_AND_FOCUSED')) {
            logger.info('이미 실행중인 프로세스가 있습니다.');
            return false;
        }

        if (stdout.includes('CONTINUE')) {
            return true;
        }

    } catch (error) {
        // Fallback or error, assume safe to start
    } finally {
        if (tempScriptPath && fs.existsSync(tempScriptPath)) {
            try {
                fs.unlinkSync(tempScriptPath);
            } catch { }
        }
    }

    return true;
};
