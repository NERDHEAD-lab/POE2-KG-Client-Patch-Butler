import semver from 'semver';
import { getAppVersion, getLatestVersionInfo } from './version.js';
import { logger } from './logger.js';

export interface UpdateCheckResult {
    hasUpdate: boolean;
    latestVersion: string;
    downloadUrl: string | null;
    releaseNotes: string;
}

export const checkForUpdate = async (): Promise<UpdateCheckResult> => {
    try {
        const latestInfo = await getLatestVersionInfo();
        const currentVersion = getAppVersion();

        if (!latestInfo) {
            logger.warn('Failed to fetch latest version info.');
            return {
                hasUpdate: false,
                latestVersion: '0.0.0',
                downloadUrl: null,
                releaseNotes: ''
            };
        }

        // If current version is "unknown" (dev mode), assume no update
        if (currentVersion === 'unknown') {
            logger.info('Dev mode detected (version unknown). Skipping update check.');
            return {
                hasUpdate: false,
                latestVersion: latestInfo.version,
                downloadUrl: null,
                releaseNotes: ''
            };
        }

        if (semver.gt(latestInfo.version, currentVersion)) {
            logger.info(`Update available: ${currentVersion} -> ${latestInfo.version}`);
            return {
                hasUpdate: true,
                latestVersion: latestInfo.version,
                downloadUrl: latestInfo.downloadUrl,
                releaseNotes: latestInfo.body
            };
        }

        logger.info(`App is up to date (v${currentVersion}).`);
        return {
            hasUpdate: false,
            latestVersion: latestInfo.version,
            downloadUrl: null,
            releaseNotes: ''
        };
    } catch (error) {
        logger.error('Update check failed: ' + error);
        return {
            hasUpdate: false,
            latestVersion: '0.0.0',
            downloadUrl: null,
            releaseNotes: ''
        };
    }
};
