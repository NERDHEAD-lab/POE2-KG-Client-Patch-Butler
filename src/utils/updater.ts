import semver from 'semver';
import { isPortableMode } from './config.js';
import { getAppVersion, getLatestVersionInfo } from './version.js';
import { logger } from './logger.js';

export interface UpdateCheckResult {
    hasUpdate: boolean;
    latestVersion: string;
    downloadUrl: string | null;
    updateType: 'installer' | 'portable';
    releaseNotes: string;
}

export const checkForUpdate = async (): Promise<UpdateCheckResult> => {
    try {
        const latestInfo = await getLatestVersionInfo();
        const currentVersion = getAppVersion();

        if (!latestInfo) {
            logger.warn('최신 버전 정보를 가져오는데 실패했습니다.');
            return {
                hasUpdate: false,
                latestVersion: '0.0.0',
                downloadUrl: null,
                updateType: 'portable',
                releaseNotes: ''
            };
        }

        // Determine update type from config
        const portable = isPortableMode();
        const updateType = portable ? 'portable' : 'installer';

        // Select URL based on type
        // if portable -> use portableUrl. if installer -> use setupUrl
        let selectedUrl = portable ? latestInfo.portableUrl : latestInfo.setupUrl;

        // Fallback: if installer mode but setupUrl missing, try portableUrl (and maybe warn?)
        // Or if portable mode but portableUrl missing, try setupUrl? (unlikely to work well)
        if (!selectedUrl && latestInfo.portableUrl) {
            selectedUrl = latestInfo.portableUrl;
        }

        // If current version is "unknown" (dev mode), assume no update
        if (currentVersion === 'unknown') {
            logger.info('개발 모드가 감지되었습니다. (버전 불명). 업데이트 확인을 건너뜁니다.');
            return {
                hasUpdate: false,
                latestVersion: latestInfo.version,
                downloadUrl: null,
                updateType: updateType,
                releaseNotes: ''
            };
        }

        if (semver.gt(latestInfo.version, currentVersion)) {
            logger.info(`새로운 업데이트가 있습니다: ${currentVersion} -> ${latestInfo.version} (${updateType})`);
            return {
                hasUpdate: true,
                latestVersion: latestInfo.version,
                downloadUrl: selectedUrl,
                updateType: updateType,
                releaseNotes: latestInfo.body
            };
        }

        return {
            hasUpdate: false,
            latestVersion: latestInfo.version,
            downloadUrl: null,
            updateType: updateType,
            releaseNotes: ''
        };
    } catch (error) {
        logger.error('업데이트 확인 실패: ' + error);
        return {
            hasUpdate: false,
            latestVersion: '0.0.0',
            downloadUrl: null,
            updateType: 'portable',
            releaseNotes: ''
        };
    }
};
