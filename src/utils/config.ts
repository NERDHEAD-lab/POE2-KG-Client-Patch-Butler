import Conf from 'conf';

// Handle ESM/CJS interop for Conf
// @ts-ignore
const ConfClass = Conf.default || Conf;

const config = new ConfClass({
    projectName: 'poe2-patch-butler',
    schema: {
        lastInstallPath: {
            type: 'string',
        },
        cookie: {
            type: 'string'
        }
    },
});

export const getLastInstallPath = (): string | undefined => {
    return config.get('lastInstallPath') as string | undefined;
};

export const setLastInstallPath = (path: string): void => {
    config.set('lastInstallPath', path);
};

export const getCookie = (): string | undefined => {
    return config.get('cookie') as string | undefined;
};

export const setCookie = (cookie: string): void => {
    config.set('cookie', cookie);
};
