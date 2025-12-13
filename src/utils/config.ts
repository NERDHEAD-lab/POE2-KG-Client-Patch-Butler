import Conf from 'conf';

interface ConfigSchema {
    lastInstallPath?: string;
}

// @ts-ignore
const ConfClass = Conf.default || Conf;

const config = new ConfClass<ConfigSchema>({
    projectName: 'poe2-kg-client-patch-butler',
    schema: {
        lastInstallPath: {
            type: 'string',
        },
    },
});

export function getLastInstallPath(): string | undefined {
    return config.get('lastInstallPath');
}

export function setLastInstallPath(path: string): void {
    config.set('lastInstallPath', path);
}
