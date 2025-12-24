import fs from 'fs';
import path from 'path';

export const WHITELIST = [
    'Client.exe',
    'PackCheck.exe',
    'PathOfExile.exe',
    'PathOfExile_x64.exe',
    'PathOfExile_KG.exe',
    'PathOfExile_x64_KG.exe'
];

export interface LogParseResult {
    webRoot: string | null;
    backupWebRoot: string | null;
    filesToDownload: string[];
    hasError: boolean;
}

export async function parseLog(installPath: string): Promise<LogParseResult> {
    const logFilePath = path.join(installPath, 'logs', 'KakaoClient.txt');

    if (!fs.existsSync(logFilePath)) {
        throw new Error(`로그 파일을 찾을 수 없습니다: ${logFilePath}`);
    }

    // Optimize: Read only last 2MB to avoid Invalid string length error
    const stats = await fs.promises.stat(logFilePath);
    const fileSize = stats.size;
    const READ_SIZE = 2 * 1024 * 1024; // 2MB

    let content = '';

    if (fileSize <= READ_SIZE) {
        content = await fs.promises.readFile(logFilePath, 'utf-8');
    } else {
        const buffer = Buffer.alloc(READ_SIZE);
        const handle = await fs.promises.open(logFilePath, 'r');
        await handle.read(buffer, 0, READ_SIZE, fileSize - READ_SIZE);
        await handle.close();
        content = buffer.toString('utf-8');
        // Ensure we don't start with a partial line (though split behavior handles it somewhat, better to be clean if possible, but existing logic seeks 'KAKAO LOG FILE OPENING' so it self-corrects)
    }

    const lines = content.split('\n');

    let webRoot: string | null = null;
    let backupWebRoot: string | null = null;
    let filesToDownload: string[] = [];
    let currentPid: string | null = null;
    let hasError = false;

    // 마지막 "KAKAO LOG FILE OPENING" 찾기
    let lastOpeningIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('***** KAKAO LOG FILE OPENING *****')) {
            lastOpeningIndex = i;
            break;
        }
    }

    if (lastOpeningIndex === -1) {
        lastOpeningIndex = 0;
    }

    const recentLines = lines.slice(lastOpeningIndex);

    // PID 추출
    // Format: DATE TIME ... [INFO Client PID] ...
    const pidRegex = /\[(?:INFO|WARN|ERROR)\s+Client\s+(\d+)\]/;

    for (const line of recentLines) {
        const match = line.match(pidRegex);
        if (match) {
            currentPid = match[1];
            break;
        }
    }

    for (const line of recentLines) {
        // PID로 필터링
        if (currentPid && !line.includes(`Client ${currentPid}`)) {
            continue;
        }

        if (line.includes('Transferred a partial file')) {
            hasError = true;
        }

        if (line.includes('Web root:')) {
            const match = line.match(/Web root: (https?:\/\/[^\s]+)/);
            if (match) webRoot = match[1];
        } else if (line.includes('Backup Web root:')) {
            const match = line.match(/Backup Web root: (https?:\/\/[^\s]+)/);
            if (match) backupWebRoot = match[1];
        } else if (line.includes('Queue file to download:')) {
            const parts = line.split('Queue file to download:');
            if (parts.length > 1) {
                const filename = parts[1].trim();
                if (filename && !filesToDownload.includes(filename) && WHITELIST.includes(filename)) {
                    filesToDownload.push(filename);
                }
            }
        }
    }

    // 에러가 없으면 다운로드 목록 초기화
    if (!hasError) {
        filesToDownload = [];
    } else {
        if (filesToDownload.includes('PathOfExile_KG.exe')) {
            filesToDownload.push('PathOfExile.exe', 'PathOfExile_x64.exe', 'PathOfExile_x64_KG.exe');
            // 중복 제거
            filesToDownload = [...new Set(filesToDownload)];
        }
    }

    return {
        webRoot,
        backupWebRoot,
        filesToDownload,
        hasError
    };
}

export function generateForcePatchResult(baseResult: LogParseResult): LogParseResult {
    if (!baseResult.webRoot) {
        throw new Error('로그에서 Web Root 정보를 찾을 수 없어 강제 패치를 진행할 수 없습니다.');
    }
    return {
        ...baseResult,
        filesToDownload: [...WHITELIST],
        hasError: true
    };
}

// Wrapper for watcher
import { getLastInstallPath } from './config.js';
import { getInstallPath } from './registry.js';

export async function checkLogForErrors(): Promise<LogParseResult> {
    const configPath = getLastInstallPath();
    if (configPath) {
        return parseLog(configPath);
    }

    const regPath = await getInstallPath();
    if (regPath) {
        return parseLog(regPath);
    }

    throw new Error('설치 경로를 찾을 수 없습니다.');
}
