import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { logger } from './logger.js';
import { getBinDirectory, getLogsDirectory } from './config.js';

const PROTOCOL_KEY = join('HKCR', 'daumgamestarter', 'shell', 'open', 'command');
const BACKUP_KEY_PATH = join('HKCU', 'Software', 'DaumGames', 'POE2', 'Backup');
const BACKUP_VALUE_NAME = 'OriginalStarterCommand';
const TASK_NAME = 'SkipDaumGameStarterUAC';

/**
 * Executes a PowerShell command with Admin privileges (RunAs).
 */
async function runPowerShellAsAdmin(psCommand: string): Promise<boolean> {
    const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
    const wrapper = `Start-Process powershell -Verb RunAs -ArgumentList "-EncodedCommand ${encodedCommand}" -WindowStyle Hidden -Wait`;
    
    return new Promise((resolve) => {
        const child = spawn('powershell', ['-Command', wrapper], { windowsHide: true });
        
        child.on('exit', (code) => {
            if (code === 0) {
                resolve(true);
            } else {
                logger.error(`PowerShell execution failed with code: ${code}`);
                resolve(false);
            }
        });

        child.on('error', (err) => {
            logger.error(`PowerShell execution error: ${err.message}`);
            resolve(false);
        });
    });
}

/**
 * Reads the current command from the registry.
 */
function getCurrentCommand(): Promise<string | null> {
    return new Promise((resolve) => {
        const child = spawn('reg', ['query', PROTOCOL_KEY, '/ve'], { windowsHide: true });
        let output = '';

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            if (code !== 0) {
                resolve(null); 
                return;
            }
            const match = output.match(/REG_SZ\s+(.*)/);
            if (match && match[1]) {
                resolve(match[1].trim());
            } else {
                resolve(null);
            }
        });
    });
}

/**
 * Checks if the bypass is currently applied.
 * It checks if our proxy script is present in the command.
 */
export async function isUACBypassEnabled(): Promise<boolean> {
    const cmd = await getCurrentCommand();
    logger.info(`Current command: ${cmd}`);
    if (!cmd) return false;
    return cmd.toLowerCase().includes('proxy.vbs');
}

/**
 * Enables the UAC Bypass (Task Scheduler Method).
 * 1. Create 'runner.vbs': Reads args from file and starts DaumGameStarter.
 * 2. Create 'proxy.vbs': Writes args to file and triggers Task.
 * 3. Create Scheduled Task: Runs runner.vbs with Highest Privileges.
 * 4. Update Registry: Point to proxy.vbs.
 */
export async function enableUACBypass(): Promise<boolean> {
    const currentCmd = await getCurrentCommand();
    if (!currentCmd) {
        logger.error('Failed to read current daumgamestarter protocol command.');
        return false;
    }

    if (currentCmd.toLowerCase().includes('proxy.vbs')) {
        logger.info('UAC Bypass is already active.');
        return true;
    }

    const binDir = getBinDirectory();
    const logsDir = getLogsDirectory();
    
    const proxyVbsPath = join(binDir, 'proxy.vbs');
    const runnerVbsPath = join(binDir, 'runner.vbs');
    const argsFilePath = join(binDir, 'launch_args.txt');
    const debugLogPath = join(logsDir, 'uac_debug.log');

    const daumStarterForScript = extractExePath(currentCmd);
    if (!daumStarterForScript) {
        logger.error(`Failed to extract valid executable path from: ${currentCmd}`);
        return false;
    }

    // 1. Create runner.vbs (Silent Runner)
    // Reads arguments from file and launches the actual starter
    const runnerScriptContent = `
On Error Resume Next
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' Read argument
Set ts = fso.OpenTextFile("${argsFilePath.replaceAll('\\', '\\\\')}", 1)
arg = ts.ReadAll
ts.Close
arg = Trim(arg)

' Log Execution (UTF-8)
Set logStream = CreateObject("ADODB.Stream")
logStream.Type = 2
logStream.Charset = "utf-8"
logStream.Open
logStream.WriteText Now & " [Runner] Starting..." & vbCrLf
logStream.WriteText Now & " [Runner] Target Exe: ${daumStarterForScript.replaceAll('\\', '\\\\')}" & vbCrLf
logStream.WriteText Now & " [Runner] Read arg: " & arg & vbCrLf

' Execute
shell.Run """${daumStarterForScript.replaceAll('\\', '\\\\')}"" " & arg, 1, False

If Err.Number <> 0 Then
    logStream.WriteText Now & " [Runner] Error: " & Err.Description & vbCrLf
End If

logStream.SaveToFile "${debugLogPath.replaceAll('\\', '\\\\')}", 2
logStream.Close
`;
    try {
        writeFileSync(runnerVbsPath, runnerScriptContent, { encoding: 'utf16le' });
    } catch (e: any) {
        logger.error(`Failed to create runner script: ${e.message}`);
        return false;
    }

    // 2. Create proxy.vbs (Silent Proxy)
    // Writes args to file and triggers Task
    const proxyScriptContent = `
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' Capture args (Protocol URL)
If WScript.Arguments.Count > 0 Then
    arg = WScript.Arguments(0)
Else
    arg = ""
End If

' Write arg to file
Set ts = fso.CreateTextFile("${argsFilePath.replaceAll('\\', '\\\\')}", True)
ts.WriteLine arg
ts.Close

' Log & Trigger Task (Hidden)
Set logStream = CreateObject("ADODB.Stream")
logStream.Type = 2
logStream.Charset = "utf-8"
logStream.Open
logStream.WriteText Now & " [Proxy] Received args: " & arg & vbCrLf
logStream.WriteText Now & " [Proxy] Triggering Task: ${TASK_NAME}" & vbCrLf
logStream.SaveToFile "${debugLogPath.replaceAll('\\', '\\\\')}", 2
logStream.Close

shell.Run "schtasks /run /tn ""${TASK_NAME}""", 0, False
`;
    try {
        writeFileSync(proxyVbsPath, proxyScriptContent, { encoding: 'utf16le' });
    } catch (e: any) {
        logger.error(`Failed to create proxy script: ${e.message}`);
        return false;
    }

    // 3. Backup Registry
    await new Promise((resolve) => {
        const args = ['add', BACKUP_KEY_PATH, '/v', BACKUP_VALUE_NAME, '/t', 'REG_SZ', '/d', currentCmd, '/f'];
        const child = spawn('reg', args, { windowsHide: true });
        child.on('close', resolve);
    });

    // 4 & 5. Combined Elevation (Single UAC Prompt)
    // - Create Scheduled Task pointing to runner.vbs
    // - Update Registry to point to proxy.vbs
    
    // Command 1: schtasks /create
    const schCommand = `schtasks /create /tn "${TASK_NAME}" /tr "wscript.exe '${runnerVbsPath}'" /sc ONCE /st 00:00 /rl HIGHEST /f`;
    
    // Command 2: Registry Update
    const newCmd = `wscript.exe "${proxyVbsPath}" "%1"`;
    const regPsScript = `Set-Item -Path "Registry::${PROTOCOL_KEY}" -Value '${newCmd}'`;
    
    // Combined Script
    const combinedScript = `${schCommand}\nif ($?) { ${regPsScript} } else { exit 1 }`;
    
    logger.info('Optimizing for silent execution... (Single UAC Prompt)');
    const result = await runPowerShellAsAdmin(combinedScript);

    if (result) {
        logger.success('Silent UAC Bypass applied successfully.');
    } else {
        logger.error('Failed to apply Silent UAC Bypass.');
    }
    
    return result;
}

/**
 * Disables the UAC Bypass.
 * 1. Restore Registry.
 * 2. Delete Scheduled Task.
 * 3. Delete generated scripts.
 */
export async function disableUACBypass(): Promise<boolean> {
    // 1. Read Backup
    const backupCmd = await new Promise<string | null>((resolve) => {
        const child = spawn('reg', ['query', BACKUP_KEY_PATH, '/v', BACKUP_VALUE_NAME], { windowsHide: true });
        let out = '';
        child.stdout.on('data', d => out += d);
        child.on('close', (code) => {
            if (code !== 0) { resolve(null); return; }
            const match = out.match(/REG_SZ\s+(.*)/);
            resolve(match ? match[1].trim() : null);
        });
    });

    if (!backupCmd) {
        logger.error('No backup found. Cannot restore safely.');
        return false;
    }

    if (backupCmd.toLowerCase().includes('proxy.vbs')) {
        logger.warn('Backup seems modified. Skipping restore.');
        return false; 
    }

    // 2 & 3. Combined Restoration (Single UAC Prompt)
    const regRestoreScript = `Set-Item -Path "Registry::${PROTOCOL_KEY}" -Value '${backupCmd}'`;
    const taskDeleteScript = `schtasks /delete /tn "${TASK_NAME}" /f`;
    const combinedRestoreScript = `${regRestoreScript}\n${taskDeleteScript}`;

    logger.info('Restoring original configuration... (Single UAC Prompt)');
    const result = await runPowerShellAsAdmin(combinedRestoreScript);

    if (!result) {
        logger.error('Failed to restore system configuration.');
        return false;
    }

    // 4. Cleanup Files
    const binDir = getBinDirectory();
    const logsDir = getLogsDirectory();
    try {
        const binFiles = ['proxy.vbs', 'runner.vbs', 'launch_args.txt'];
        binFiles.forEach(f => {
            const p = join(binDir, f);
            if (existsSync(p)) unlinkSync(p);
        });

        const logPath = join(logsDir, 'uac_debug.log');
        if (existsSync(logPath)) unlinkSync(logPath);

        logger.success('Cleanup complete. UAC Bypass disabled.');
    } catch (e: any) {
        logger.warn(`Cleanup partial error: ${e.message}`);
    }

    return true;
}

/**
 * Helper to extract executable path from a command string.
 */
function extractExePath(cmd: string): string | null {
    let exePath = '';
    
    if (cmd.startsWith('"')) {
        const nextQuote = cmd.indexOf('"', 1);
        if (nextQuote !== -1) {
            exePath = cmd.substring(1, nextQuote);
        }
    } else {
        const firstSpace = cmd.indexOf(' ');
        exePath = firstSpace >= 0 ? cmd.substring(0, firstSpace) : cmd;
    }

    if (exePath && exePath !== '%1' && exePath.toLowerCase().endsWith('.exe')) {
        return exePath;
    }

    // Second attempt: search for something ending in .exe before %1
    const exeMatch = cmd.match(/([A-Z]:\\[^"]+\.exe)/i);
    return exeMatch ? exeMatch[1] : null;
}
