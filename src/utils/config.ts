import Conf from 'conf';
import path from 'path';
import process from 'process';
import fs from 'fs';

// Handle ESM/CJS interop for Conf
// @ts-ignore
const ConfClass = Conf.default || Conf;

const APP_DATA_ROOT = path.join(process.env.APPDATA || process.env.HOME || '', 'poe2-patch-butler');
const CONFIG_DIR = path.join(APP_DATA_ROOT, 'config');

const config = new ConfClass({
    cwd: CONFIG_DIR,
    projectName: 'poe2-patch-butler',
    projectSuffix: '', // -nodejs 접미사 제거
    schema: {
        lastInstallPath: {
            type: 'string',
        },
        lastMigratedVersion: {
            type: 'string',
        },
        isBackupEnabled: {
            type: 'boolean',
            default: false
        },
        titleVersion: {
            type: 'string'
        },
        maxSeenTitleVersion: {
            type: 'string'
        },
        preferredBrowserPath: {
            type: 'string'
        },
        preferredBrowserProfile: {
            type: 'string'
        },
        preferredBrowserDisplayName: {
            type: 'string'
        }
    },
});

export const getBackupEnabled = (): boolean => {
    return (config.get('isBackupEnabled') as boolean) || false;
};

export const setBackupEnabled = (enabled: boolean): void => {
    config.set('isBackupEnabled', enabled);
};

export const getLastMigratedVersion = (): string => {
    return (config.get('lastMigratedVersion') as string) || '0.0.0';
};

export const setLastMigratedVersion = (version: string): void => {
    config.set('lastMigratedVersion', version);
};

// Returns the folder containing the config file (.../config)
export const getConfigDirectory = (): string => {
    return CONFIG_DIR;
};

// Returns the root application data folder (.../poe2-patch-butler)
export const getAppDataDirectory = (): string => {
    return APP_DATA_ROOT;
};

// Returns the binary directory (.../bin)
export const getBinDirectory = (): string => {
    const binDir = path.join(APP_DATA_ROOT, 'bin');
    if (!fs.existsSync(binDir)) {
        try { fs.mkdirSync(binDir, { recursive: true }); } catch (e) { console.error(e); }
    }
    return binDir;
};

// Returns the logs directory (.../logs)
export const getLogsDirectory = (): string => {
    const logsDir = path.join(APP_DATA_ROOT, 'logs');
    if (!fs.existsSync(logsDir)) {
        try { fs.mkdirSync(logsDir, { recursive: true }); } catch (e) { console.error(e); }
    }
    return logsDir;
};

export const getLastInstallPath = (): string | undefined => {
    return config.get('lastInstallPath') as string | undefined;
};

export const setLastInstallPath = (path: string): void => {
    config.set('lastInstallPath', path);
};
// Check if the application is running in portable mode (no uninstaller found)
export const isPortableMode = (): boolean => {
    // In dev mode (running via node), we might not have unins000.exe, effectively acting like portable or dev
    if (process.env.NODE_ENV === 'development') {
        return true;
    }
    const appRoot = path.dirname(process.execPath);
    const uninstallerPath = path.join(appRoot, 'unins000.exe');
    return !fs.existsSync(uninstallerPath);
};

export const getSilentModeEnabled = (): boolean => {
    const silentFile = path.join(APP_DATA_ROOT, '.silent_mode');
    return fs.existsSync(silentFile);
};

export const setSilentModeEnabled = (enabled: boolean): void => {
    const silentFile = path.join(APP_DATA_ROOT, '.silent_mode');
    if (enabled) {
        if (!fs.existsSync(silentFile)) {
            try { fs.writeFileSync(silentFile, ''); } catch (e) { console.error(e); }
        }
    } else {
        if (fs.existsSync(silentFile)) {
            try { fs.unlinkSync(silentFile); } catch (e) { console.error(e); }
        }
    }
};

export const getAutoLaunchGameEnabled = (): boolean => {
    return (config.get('AutoLaunchGame') as boolean) || false;
};

export const setAutoLaunchGameEnabled = (enabled: boolean): void => {
    config.set('AutoLaunchGame', enabled);
};

export const _setTitleVersion = (version: string): void => {
    config.set('titleVersion', version);
};

export const _getTitleVersion = (): string | undefined => {
    return config.get('titleVersion') as string | undefined;
};

export const _setMaxSeenTitleVersion = (version: string): void => {
    config.set('maxSeenTitleVersion', version);
};

export const _getMaxSeenTitleVersion = (): string | undefined => {
    return config.get('maxSeenTitleVersion') as string | undefined;
};

export const getPreferredBrowserPath = (): string | undefined => {
    return config.get('preferredBrowserPath') as string | undefined;
};

export const setPreferredBrowserPath = (path: string): void => {
    config.set('preferredBrowserPath', path);
};

export const getPreferredBrowserProfile = (): string | undefined => {
    return config.get('preferredBrowserProfile') as string | undefined;
};

export const setPreferredBrowserProfile = (profile: string): void => {
    config.set('preferredBrowserProfile', profile);
};

export const getPreferredBrowserDisplayName = (): string | undefined => {
    return config.get('preferredBrowserDisplayName') as string | undefined;
};

export const setPreferredBrowserDisplayName = (displayName: string): void => {
    config.set('preferredBrowserDisplayName', displayName);
};

export const clearBrowserPreferences = (): void => {
    config.delete('preferredBrowserPath');
    config.delete('preferredBrowserProfile');
    config.delete('preferredBrowserDisplayName');
};
