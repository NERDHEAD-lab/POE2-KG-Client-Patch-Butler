import fs from 'fs';
import path from 'path';

export interface LogParseResult {
    webRoot: string | null;
    backupWebRoot: string | null;
    filesToDownload: string[];
}

export async function parseLog(installPath: string): Promise<LogParseResult> {
    const logFilePath = path.join(installPath, 'logs', 'KakaoClient.txt');

    if (!fs.existsSync(logFilePath)) {
        throw new Error(`Log file not found at: ${logFilePath}`);
    }

    const content = await fs.promises.readFile(logFilePath, 'utf-8');
    const lines = content.split('\n');

    let webRoot: string | null = null;
    let backupWebRoot: string | null = null;
    let filesToDownload: string[] = [];

    // Find the last "KAKAO LOG FILE OPENING"
    let lastOpeningIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('***** KAKAO LOG FILE OPENING *****')) {
            lastOpeningIndex = i;
            break;
        }
    }

    if (lastOpeningIndex === -1) {
        // If not found, scan the whole file (or maybe just return empty if strictly required)
        lastOpeningIndex = 0;
    }

    const recentLines = lines.slice(lastOpeningIndex);

    for (const line of recentLines) {
        if (line.includes('Web root:')) {
            const match = line.match(/Web root: (https?:\/\/[^\s]+)/);
            if (match) webRoot = match[1];
        } else if (line.includes('Backup Web root:')) {
            const match = line.match(/Backup Web root: (https?:\/\/[^\s]+)/);
            if (match) backupWebRoot = match[1];
        } else if (line.includes('Queue file to download:')) {
            // Format: ... Queue file to download: Client.exe
            const parts = line.split('Queue file to download:');
            if (parts.length > 1) {
                const filename = parts[1].trim();
                if (filename && !filesToDownload.includes(filename)) {
                    filesToDownload.push(filename);
                }
            }
        }
    }

    return {
        webRoot,
        backupWebRoot,
        filesToDownload,
    };
}
