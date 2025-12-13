import axios from 'axios';
import fs from 'fs';
import path from 'path';

export interface DownloadProgress {
    fileName: string;
    transferred: number;
    total: number;
    percentage: number;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

async function downloadFile(
    url: string,
    destPath: string,
    fileName: string,
    onProgress?: ProgressCallback
): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
    }

    const writer = fs.createWriteStream(destPath);

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
    });

    const totalLength = parseInt(response.headers['content-length'] || '0', 10);
    let transferred = 0;

    response.data.on('data', (chunk: Buffer) => {
        transferred += chunk.length;
        if (onProgress) {
            onProgress({
                fileName,
                transferred,
                total: totalLength,
                percentage: totalLength > 0 ? Math.round((transferred / totalLength) * 100) : 0,
            });
        }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.on('error', reject);
    });
}

export async function downloadFiles(
    webRoot: string,
    backupWebRoot: string,
    files: string[],
    installPath: string,
    onProgress?: ProgressCallback
): Promise<void> {
    for (const file of files) {
        const destPath = path.join(installPath, file);
        // Try primary URL
        try {
            const url = `${webRoot}${file}`;
            await downloadFile(url, destPath, file, onProgress);
        } catch (err) {
            // Try backup URL
            if (webRoot !== backupWebRoot && backupWebRoot) {
                try {
                    const backupUrl = `${backupWebRoot}${file}`;
                    await downloadFile(backupUrl, destPath, file, onProgress);
                } catch (backupErr) {
                    throw new Error(`Failed to download ${file} from both sources.`);
                }
            } else {
                throw new Error(`Failed to download ${file}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }
}
