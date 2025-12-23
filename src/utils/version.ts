import axios from 'axios';

const GITHUB_REPO = 'NERDHEAD-lab/POE2-KG-Client-Patch-Butler';
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface LatestVersionInfo {
    version: string;
    portableUrl: string | null;
    setupUrl: string | null;
    body: string;
}

export const getAppVersion = (): string => {
    return process.env.APP_VERSION || '0.0.0';
};

export const getLatestVersionInfo = async (): Promise<LatestVersionInfo | null> => {
    try {
        const response = await axios.get(RELEASES_API);
        const latestData = response.data;
        const tagName = latestData.tag_name; // e.g., "v1.2.0"
        const cleanLatestVersion = tagName.replace(/^v/, '');

        const portableAsset = latestData.assets.find((a: any) =>
            a.name.endsWith('.exe') &&
            !a.name.toLowerCase().includes('setup') &&
            !a.name.toLowerCase().includes('installer')
        );

        const setupAsset = latestData.assets.find((a: any) =>
            a.name.endsWith('.exe') &&
            (a.name.toLowerCase().includes('setup') || a.name.toLowerCase().includes('installer'))
        );

        return {
            version: cleanLatestVersion,
            portableUrl: portableAsset ? portableAsset.browser_download_url : null,
            setupUrl: setupAsset ? setupAsset.browser_download_url : null,
            body: latestData.body
        };
    } catch (error) {
        // console.error('Failed to fetch latest version info:', error);
        return null;
    }
};

// for testing
// export const getLatestVersionInfo = async (): Promise<LatestVersionInfo | null> => {
//     // TEST MODE: Hardcoded for testing self-update
//     return {
//         version: '99.99.99',
//         portableUrl: 'https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler/releases/download/1.4.0-SNAPSHOT/poe2-patch-butler.exe',
//         setupUrl: 'https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler/releases/download/1.4.0-SNAPSHOT/poe2-patch-butler-setup.exe',
//         body: 'Testing Self Update - Hardcoded URL (1.4.0-SNAPSHOT)'
//     };
// };