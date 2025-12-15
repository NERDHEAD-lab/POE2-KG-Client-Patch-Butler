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
                // 키를 찾지 못하거나 에러 발생 시 null 반환
                resolve(null);
            } else {
                resolve(item ? item.value : null);
            }
        });
    });
}
