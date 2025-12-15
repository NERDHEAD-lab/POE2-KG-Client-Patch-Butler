import Conf from 'conf';

// Handle ESM/CJS interop for Conf
// @ts-ignore
const ConfClass = Conf.default || Conf;

const config = new ConfClass({
    projectName: 'poe2-patch-butler',
    projectSuffix: '', // -nodejs 접미사 제거
    schema: {
        lastInstallPath: {
            type: 'string',
        }
    },
});

// Cleanup old config folder with -nodejs suffix
try {
    const appData = process.env.APPDATA;
    if (appData) {
        // Explicitly import fs and path here since they might not be imported yet in this file
        const fs = await import('fs');
        const path = await import('path');
        const oldPath = path.default.join(appData, 'poe2-patch-butler-nodejs');
        if (fs.default.existsSync(oldPath)) {
            fs.default.rmSync(oldPath, { recursive: true, force: true });
        }
    }
} catch (e) {
    // Ignore cleanup errors
}

export const getLastInstallPath = (): string | undefined => {
    return config.get('lastInstallPath') as string | undefined;
};

export const setLastInstallPath = (path: string): void => {
    config.set('lastInstallPath', path);
};
