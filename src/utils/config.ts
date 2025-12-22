import Conf from 'conf';
import path from 'path';
import process from 'process';

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

export const getLastInstallPath = (): string | undefined => {
    return config.get('lastInstallPath') as string | undefined;
};

export const setLastInstallPath = (path: string): void => {
    config.set('lastInstallPath', path);
};
