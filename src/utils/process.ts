import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ProcessInfo {
    name: string;
    pid: number;
    commandLine: string;
}

export const getProcessInfo = async (processName: string): Promise<ProcessInfo | null> => {
    try {
        const cmd = `wmic process where "name='${processName}'" get commandline,processid /format:csv`;
        const { stdout } = await execAsync(cmd, { windowsHide: true });

        const lines = stdout.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) return null;

        for (const line of lines) {
            if (line.toLowerCase().startsWith('node')) continue;

            const match = line.match(/^([^,]+),(.*),(\d+)\s*$/);
            if (match) {
                return {
                    name: processName,
                    pid: parseInt(match[3]),
                    commandLine: match[2] || ''
                };
            }
        }
        return null;
    } catch (e) {
        return null;
    }
};

export const isProcessRunning = async (processName: string): Promise<boolean> => {
    const info = await getProcessInfo(processName);
    return !!info;
};
