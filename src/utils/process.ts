import { promisify } from 'node:util';
import { execFile, spawn } from 'node:child_process';

const execFileAsync = promisify(execFile);

export const isProcessRunning = async (processName: string): Promise<boolean> => {
    try {
        const { stdout } = await execFileAsync('tasklist', ['/FI', `IMAGENAME eq ${processName}`, '/FO', 'CSV', '/NH'], { windowsHide: true });
        // If the process is running, stdout will contain the process name.
        return stdout.toLowerCase().includes(`"${processName.toLowerCase()}"`);
    } catch (e) {
        return false;
    }
};

export const setConsoleSize = async (cols: number, lines: number): Promise<void> => {
    try {
        // Method 1: ANSI Escape Sequence (xterm/Windows Terminal)
        // \x1b[8;{rows};{cols}t
        process.stdout.write(`\x1b[8;${lines};${cols}t`);

        // Method 2: 'mode' command using spawn with inherited stdio (Legacy/Conhost)
        await new Promise<void>((resolve) => {
             const child = spawn('mode', ['con:', `cols=${cols}`, `lines=${lines}`], {
                 stdio: 'inherit', // Critical: inherit parent console handles
                 shell: true
             });
             
             child.on('error', () => resolve());
             child.on('exit', () => resolve());
        });
    } catch (e) {
        // Ignore errors if resizing fails
    }
};
