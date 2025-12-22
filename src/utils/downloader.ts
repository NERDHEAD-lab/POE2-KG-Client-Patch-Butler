import axios from 'axios';
import fs from 'fs';
import path from 'path';

export interface DownloadResult {
    success: boolean;
    failures: { fileName: string; error: Error }[];
}

export interface FileStatus {
    fileName: string;
    userName: string;
    status: 'waiting' | 'downloading' | 'done' | 'error';
    progress: number;
    error?: Error;
}

export type StatusCallback = (status: FileStatus) => void;

export async function downloadFile(
    url: string,
    destPath: string,
    fileName: string,
    onStatus: StatusCallback
): Promise<void> {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
    }

    const MAX_RETRIES = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const writer = fs.createWriteStream(destPath);

        try {
            if (attempt > 1) {
                // 재시도 대기 시간: 1초, 2초, 4초... (서버 부하 방지)
                const delay = 1000 * Math.pow(2, attempt - 2);
                await new Promise(resolve => setTimeout(resolve, delay));
                onStatus({
                    fileName,
                    userName: fileName,
                    status: 'downloading',
                    progress: 0
                });
            }

            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
                timeout: 30000, // 30초 타임아웃
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Connection': 'keep-alive',
                    'Accept-Encoding': 'identity' // 압축 없이 원본 크기 수신 (진행률 표시 오류 수정)
                }
            });

            const totalLength = parseInt(response.headers['content-length'] || '0', 10);
            let transferred = 0;

            response.data.on('data', (chunk: Buffer) => {
                transferred += chunk.length;
                onStatus({
                    fileName,
                    userName: fileName,
                    status: 'downloading',
                    progress: totalLength > 0 ? Math.round((transferred / totalLength) * 100) : 0
                });
            });

            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    onStatus({
                        fileName,
                        userName: fileName,
                        status: 'done',
                        progress: 100
                    });
                    resolve(null);
                });
                writer.on('error', (err) => reject(new Error(`File write error: ${err.message}`)));
                response.data.on('error', (err: any) => reject(new Error(`Stream error: ${err.message}`)));
            });

            return; // Success, exit function

        } catch (err: any) {
            lastError = err;
            try {
                writer.close();
                if (fs.existsSync(destPath)) await fs.promises.unlink(destPath);
            } catch (e) { }

            const isLastAttempt = attempt === MAX_RETRIES;
            if (isLastAttempt) {
                const status = err.response?.status ? ` (Status: ${err.response.status})` : '';
                throw new Error(`"${url}" 다운로드 실패${status}: ${err.message}`);
            }
        }
    }
}

import { getBackupEnabled } from './config.js';

// ... (existing imports)

export async function downloadFiles(
    webRoot: string,
    backupWebRoot: string,
    files: string[],
    installPath: string,
    onStatus: StatusCallback
): Promise<DownloadResult> {
    const CONCURRENCY_LIMIT = 2;
    const tempDir = path.join(installPath, '.patch_temp');
    // Prepare backup directory if enabled
    const isBackupEnabled = getBackupEnabled();
    const backupDir = path.join(installPath, '.patch_backups');

    if (!fs.existsSync(tempDir)) {
        await fs.promises.mkdir(tempDir, { recursive: true });
    }

    if (isBackupEnabled) {
        if (!fs.existsSync(backupDir)) {
            await fs.promises.mkdir(backupDir, { recursive: true });
        }
        // Force version.txt update even if folder exists
    }

    const queue = [...files];
    const activePromises: Promise<void>[] = [];
    const failures: { fileName: string; error: Error }[] = [];

    // 상태 초기화
    files.forEach(f => onStatus({
        fileName: f,
        userName: f,
        status: 'waiting',
        progress: 0
    }));

    const processQueue = async () => {
        while (queue.length > 0) {
            if (activePromises.length < CONCURRENCY_LIMIT) {
                const file = queue.shift();
                if (!file) break;

                // 봇 탐지 우회 및 서버 부하 분산을 위한 랜덤 지연 (Jitter)
                const jitter = Math.floor(Math.random() * 500) + 100;
                await new Promise(r => setTimeout(r, jitter));


                const destPath = path.join(tempDir, file);
                const cleanWebRoot = webRoot.endsWith('/') ? webRoot : webRoot + '/';
                const cleanBackupWebRoot = backupWebRoot ? (backupWebRoot.endsWith('/') ? backupWebRoot : backupWebRoot + '/') : null;
                const url = `${cleanWebRoot}${file}`;
                const backupUrl = cleanBackupWebRoot ? `${cleanBackupWebRoot}${file}` : null;

                const promise = (async () => {
                    try {
                        await downloadFile(url, destPath, file, onStatus);
                    } catch (err: any) {
                        try {
                            if (backupUrl && cleanWebRoot !== cleanBackupWebRoot) {
                                await downloadFile(backupUrl, destPath, file, onStatus);
                            } else {
                                throw err;
                            }
                        } catch (finalErr: any) {
                            failures.push({ fileName: file, error: finalErr });
                            onStatus({
                                fileName: file,
                                userName: file,
                                status: 'error',
                                progress: 0,
                                error: finalErr
                            });
                        }
                    }
                })().finally(() => {
                    activePromises.splice(activePromises.indexOf(promise), 1);
                });

                activePromises.push(promise);
            } else {
                await Promise.race(activePromises);
            }
        }
        await Promise.all(activePromises);
    };

    try {
        await processQueue();

        if (failures.length > 0) {
            return { success: false, failures };
        }

        // Helper for Korean Error Messages
        const getFriendlyErrorMessage = (error: any): string => {
            // ... (existing helper)
            const msg = error instanceof Error ? error.message : String(error);
            const code = (error as any).code;

            if (code === 'EBUSY') {
                return `파일이 현재 사용 중이라 접근할 수 없습니다. (EBUSY)\n게임이나 관련 프로그램이 켜져 있는지 확인해 주세요.`;
            }
            if (code === 'EPERM' || code === 'EACCES') {
                return `파일 권한이 부족합니다. (EACCES)\n관리자 권한으로 실행해 보세요.`;
            }
            if (code === 'ENOENT') {
                return `파일 경로를 찾을 수 없습니다. (${code})`;
            }
            if (code === 'ENOSPC') {
                return `디스크 공간이 부족합니다. (${code})`;
            }

            return msg;
        };

        let backupCount = 0;

        // 임시 폴더에서 설치 경로로 이동
        for (const file of files) {
            const tempPath = path.join(tempDir, file);
            const finalPath = path.join(installPath, file);

            try {
                if (fs.existsSync(tempPath)) {
                    const finalDir = path.dirname(finalPath);
                    if (!fs.existsSync(finalDir)) {
                        await fs.promises.mkdir(finalDir, { recursive: true });
                    }

                    // BACKUP LOGIC
                    if (isBackupEnabled && fs.existsSync(finalPath)) {
                        const backupPath = path.join(backupDir, file);
                        const backupFileDir = path.dirname(backupPath);
                        if (!fs.existsSync(backupFileDir)) {
                            await fs.promises.mkdir(backupFileDir, { recursive: true });
                        }
                        await fs.promises.copyFile(finalPath, backupPath);
                        backupCount++;
                    }

                    await fs.promises.copyFile(tempPath, finalPath);
                    // 안전을 위해 원본은 임시 폴더에 유지하고, 사용자가 삭제 여부를 결정하도록 함
                }
            } catch (error) {
                const friendlyMsg = getFriendlyErrorMessage(error);
                throw new Error(`${file} 설치 중 오류 발생:\n${friendlyMsg}`);
            }
        }

        // Write version.txt if backups were made or simply if backup mode is on and we finished
        if (isBackupEnabled) {
            const versionFilePath = path.join(backupDir, 'version.txt');
            const now = new Date();
            const timestamp = now.toLocaleString('ko-KR', { hour12: false }); // e.g. "2023. 12. 23. 14:00:00" depending on locale
            await fs.promises.writeFile(versionFilePath, `Backup Date: ${timestamp}\nAuto-generated by POE2 Patch Butler`, 'utf8');
        }

        return { success: true, failures: [] };

    } finally {
        // ...
    }
}

export async function cleanupTempDir(installPath: string): Promise<void> {
    const tempDir = path.join(installPath, '.patch_temp');
    try {
        if (fs.existsSync(tempDir)) {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        }
    } catch (e) {
        // ignore
    }
}
