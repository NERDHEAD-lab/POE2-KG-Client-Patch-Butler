import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

const BACKUP_DIR_NAME = '.patch_backups';
const VERSION_FILE_NAME = 'version.txt';

export const getBackupInfo = async (installPath: string): Promise<string | null> => {
    try {
        const backupDir = path.join(installPath, BACKUP_DIR_NAME);
        const versionFile = path.join(backupDir, VERSION_FILE_NAME);

        if (!fs.existsSync(versionFile)) {
            return null;
        }

        const content = await fs.promises.readFile(versionFile, 'utf8');
        return content.trim();
    } catch (e) {
        return null;
    }
};

export const restoreBackup = async (installPath: string): Promise<boolean> => {
    const backupDir = path.join(installPath, BACKUP_DIR_NAME);

    if (!fs.existsSync(backupDir)) {
        logger.error('백업 폴더가 존재하지 않습니다.');
        return false;
    }

    try {
        const files = await fs.promises.readdir(backupDir);
        let restoredCount = 0;

        for (const file of files) {
            if (file === VERSION_FILE_NAME) continue;

            const backupFilePath = path.join(backupDir, file);
            const targetFilePath = path.join(installPath, file); // Assuming flat structure for simplicity as per downloader.ts

            await copyRecursive(backupFilePath, targetFilePath);
            restoredCount++;
        }

        logger.success(`백업 복구 완료: ${restoredCount}개 항목이 성공적으로 복원되었습니다.`);
        return true;
    } catch (e) {
        logger.error('백업 복구 중 오류가 발생했습니다: ' + e);
        return false;
    }
};

export const deleteBackup = async (installPath: string): Promise<void> => {
    const backupDir = path.join(installPath, BACKUP_DIR_NAME);
    if (fs.existsSync(backupDir)) {
        await fs.promises.rm(backupDir, { recursive: true, force: true });
        logger.info('백업 폴더가 안전하게 제거되었습니다.');
    }
};

async function copyRecursive(src: string, dest: string) {
    const stats = await fs.promises.stat(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) {
            await fs.promises.mkdir(dest, { recursive: true });
        }
        const entries = await fs.promises.readdir(src);
        for (const entry of entries) {
            await copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
            await fs.promises.mkdir(destDir, { recursive: true });
        }
        await fs.promises.copyFile(src, dest);
    }
}
