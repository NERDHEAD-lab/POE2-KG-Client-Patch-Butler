import semver from 'semver';
import { getAppVersion, getLatestVersionInfo } from './version.js';

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
            return {
                hasUpdate: false,
                latestVersion: '0.0.0',
                downloadUrl: null,
                releaseNotes: ''
            };
        }

        // If current version is "unknown" (dev mode), assume no update
        if (currentVersion === 'unknown') {
            return {
                hasUpdate: false,
                latestVersion: latestInfo.version,
                downloadUrl: null,
                releaseNotes: ''
            };
        }

        if (semver.gt(latestInfo.version, currentVersion)) {
            return {
                hasUpdate: true,
                latestVersion: latestInfo.version,
                downloadUrl: latestInfo.downloadUrl,
                releaseNotes: latestInfo.body
            };
        }

        return {
            hasUpdate: false,
            latestVersion: latestInfo.version,
            downloadUrl: null,
            releaseNotes: ''
        };
    } catch (error) {
        return {
            hasUpdate: false,
            latestVersion: '0.0.0',
            downloadUrl: null,
            releaseNotes: ''
        };
    }
};
