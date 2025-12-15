import axios from 'axios';

const GITHUB_REPO = 'NERDHEAD-lab/POE2-KG-Client-Patch-Butler';
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface LatestVersionInfo {
    version: string;
    downloadUrl: string | null;
    body: string;
}

export const getAppVersion = (): string => {
    return process.env.APP_VERSION || 'unknown';
};

export const getLatestVersionInfo = async (): Promise<LatestVersionInfo | null> => {
    try {
        const response = await axios.get(RELEASES_API);
        const latestData = response.data;
        const tagName = latestData.tag_name; // e.g., "v1.2.0"
        const cleanLatestVersion = tagName.replace(/^v/, '');

        // Find asset with name ending in .exe
        const asset = latestData.assets.find((a: any) => a.name.endsWith('.exe'));

        return {
            version: cleanLatestVersion,
            downloadUrl: asset ? asset.browser_download_url : null,
            body: latestData.body
        };
    } catch (error) {
        // console.error('Failed to fetch latest version info:', error);
        return null;
    }
};
