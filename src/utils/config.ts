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
        },
        lastMigratedVersion: {
            type: 'string',
        }
    },
});

export const getLastMigratedVersion = (): string => {
    return (config.get('lastMigratedVersion') as string) || '0.0.0';
};

export const setLastMigratedVersion = (version: string): void => {
    config.set('lastMigratedVersion', version);
};

export const getLastInstallPath = (): string | undefined => {
    return config.get('lastInstallPath') as string | undefined;
};

export const setLastInstallPath = (path: string): void => {
    config.set('lastInstallPath', path);
};
