import semver from 'semver';
import fs from 'fs';
import path from 'path';
import { getLastMigratedVersion, setLastMigratedVersion } from './config.js';
import { isAutoDetectRegistryEnabled, disableAutoDetectRegistry, enableAutoDetectRegistry } from './autoDetect.js';
import { logger } from './logger.js';

interface Migration {
    version: string;
    description: string;
    run: () => Promise<void>;
}

const migrations: Migration[] = [
    {
        version: '1.1.0',
        description: 'Cleanup legacy configuration folder (poe2-patch-butler-nodejs)',
        run: async () => {
            const appData = process.env.APPDATA || process.env.USERPROFILE;
            if (!appData) {
                return;
            }

            const oldPath = path.join(appData, 'poe2-patch-butler-nodejs');
            if (!fs.existsSync(oldPath)) {
                return;
            }

            try {
                fs.rmSync(oldPath, { recursive: true, force: true });
            } catch (e) {
                logger.error('Failed to remove legacy config folder: ' + e);
            }
        }
    },
    {
        version: '1.3.1',
        description: 'Move silent_launcher.vbs from executable dir to AppData',
        run: async () => {
            const exeDir = path.dirname(process.execPath);
            const VBS_NAME = 'silent_launcher.vbs';
            const oldVbsPath = path.join(exeDir, VBS_NAME);

            if (!fs.existsSync(oldVbsPath)) {
                return;
            }

            try {
                const isEnabled = await isAutoDetectRegistryEnabled();
                if (!isEnabled) {
                    fs.unlinkSync(oldVbsPath);
                    return;
                }

                await disableAutoDetectRegistry();

                if (fs.existsSync(oldVbsPath)) {
                    fs.unlinkSync(oldVbsPath);
                }

                await enableAutoDetectRegistry();
            } catch (e) {
                logger.error('Failed to migrate VBS location: ' + e);
            }
        },
    },
    {
        version: '1.4.0',
        description: 'Force re-install for installer version users to fix uninstaller',
        run: async () => {
            const { isPortableMode } = await import('./config.js');
            if (isPortableMode()) {
                return;
            }

            // Check if we already have the "InstallVersion" registry key.
            // If it exists, it means the user has installed/updated via the new installer that writes this key.
            // In that case, we don't need to force re-install (it avoids infinite loop too).
            try {
                const { exec } = await import('child_process');
                const { promisify } = await import('util');
                const execAsync = promisify(exec);

                // Check specifically for our key
                await execAsync('reg query "HKCU\\Software\\NERDHEAD LAB\\POE2 Patch Butler" /v "InstallVersion"');

                // If the command succeeds, the key exists.
                logger.info('마이그레이션 (1.4.0) 건너뜀: 신규 설치 감지됨 (레지스트리 키 발견).');
                return;
            } catch (e) {
                // Registry key not found (or other error), proceed with migration
            }

            // If we are here, we are on 1.4.0+ (implied by migration running) and using installer mode.
            // We need to force re-install the current version (or latest) to fix uninstaller/registry.
            try {
                const { getLatestVersionInfo } = await import('./version.js');
                const { performSelfUpdate } = await import('./selfUpdate.js');
                const { downloadFile } = await import('./downloader.js');
                const os = await import('os');

                const latestInfo = await getLatestVersionInfo();
                if (!latestInfo || !latestInfo.setupUrl) {
                    logger.warn('마이그레이션 (1.4.0) 건너뜀: 설치 파일 URL을 찾을 수 없음.');
                    return;
                }

                logger.info('마이그레이션 (1.4.0): 내부 구조 복구를 위해 재설치를 진행합니다...');

                const tempPath = path.join(os.tmpdir(), `poe2-patch-butler-setup-${latestInfo.version}.exe`);

                await downloadFile(latestInfo.setupUrl, tempPath, 'setup.exe', (s) => {
                    // Silent download, maybe log progress sparingly?
                    if (s.progress % 20 === 0) logger.info(`마이그레이션 파일 다운로드 중: ${s.progress}%`);
                });

                logger.success('마이그레이션 다운로드 완료. Watcher 중지 및 설치 프로그램 재시작...');

                const { stopWatcherProcess } = await import('./autoDetect.js');
                await stopWatcherProcess();

                performSelfUpdate(tempPath, 'installer');

                // Stop execution here as app will restart
                await new Promise(r => setTimeout(r, 10000));
            } catch (e) {
                logger.error('마이그레이션 (1.4.0) 실패: ' + e);
            }
        }
    }
];

import { getAppVersion } from './version.js';

export const runMigrations = async () => {
    const currentVersion = getAppVersion();
    const lastVersion = getLastMigratedVersion();

    const pendingMigrations = migrations.filter(m =>
        semver.gt(m.version, lastVersion) && semver.lte(m.version, currentVersion)
    ).sort((a, b) => semver.compare(a.version, b.version));

    if (pendingMigrations.length === 0) {
        return;
    }

    for (const migration of pendingMigrations) {
        try {
            await migration.run();
            setLastMigratedVersion(migration.version);
        } catch (e) {
            logger.error(`Migration ${migration.version} failed: ${e}`);
            throw e;
        }
    }
};
