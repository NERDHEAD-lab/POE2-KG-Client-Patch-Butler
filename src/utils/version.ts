export const getAppVersion = (): string => {
    return process.env.APP_VERSION || 'unknown';
};
