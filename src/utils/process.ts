import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const isProcessRunning = async (processName: string): Promise<boolean> => {
    try {
        const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${processName}" /FO CSV /NH`);
        // If the process is running, stdout will contain the process name.
        // If not running, it might return "INFO: No tasks are running..." or just empty depending on localization/system.
        // But reliably, if it contains the process name in quotes, it's running.
        return stdout.toLowerCase().includes(`"${processName.toLowerCase()}"`);
    } catch (e) {
        // Checking failed, assume not running or error out?
        // Usually assume not running if tasklist fails, but let's log if needed.
        return false;
    }
};
