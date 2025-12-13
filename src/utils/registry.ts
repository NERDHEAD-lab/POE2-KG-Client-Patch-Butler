import Winreg from 'winreg';

export const REGISTRY_KEY = '\\Software\\DaumGames\\POE2';
export const REGISTRY_VALUE = 'InstallPath';

// @ts-ignore
const WinregClass = Winreg.default || Winreg;

export async function getInstallPath(): Promise<string | null> {
    return new Promise((resolve, reject) => {
        const regKey = new WinregClass({
            hive: Winreg.HKCU,
            key: REGISTRY_KEY,
        });

        regKey.get(REGISTRY_VALUE, (err: Error | null, item: Winreg.RegistryItem) => {
            if (err) {
                // If key not found or other error, return null to indicate failure
                // We might want to log this in verbose mode
                resolve(null);
            } else {
                resolve(item ? item.value : null);
            }
        });
    });
}
