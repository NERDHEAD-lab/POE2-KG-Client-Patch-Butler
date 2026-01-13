
import fs from 'fs';
import path from 'path';
import process from 'process';
import { spawn } from 'child_process';
import { logger } from './logger.js';

export interface BrowserProfile {
    browserName: 'Chrome' | 'Edge' | 'Whale' | 'Brave' | 'Firefox' | 'Default';
    profileName: string; // "Default", "Profile 1" (Chromium) or "default-release" (Firefox)
    displayName: string; // "User 1" (Chromium) or "default-release" (Firefox)
    executablePath: string;
}

const BROWSERS = {
    Chrome: {
        type: 'chromium',
        executable: 'Google\\Chrome\\Application\\chrome.exe',
        userData: 'Google\\Chrome\\User Data',
    },
    Edge: {
        type: 'chromium',
        executable: 'Microsoft\\Edge\\Application\\msedge.exe',
        userData: 'Microsoft\\Edge\\User Data',
    },
    Whale: {
        type: 'chromium',
        executable: 'Naver\\Naver Whale\\Application\\whale.exe',
        userData: 'Naver\\Naver Whale\\User Data',
    },
    Brave: {
        type: 'chromium',
        executable: 'BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        userData: 'BraveSoftware\\Brave-Browser\\User Data',
    },
    Firefox: {
        type: 'firefox',
        executable: 'Mozilla Firefox\\firefox.exe',
        // Firefox uses Roaming AppData for profiles.ini
        userData: 'Mozilla\\Firefox', 
    },
};

export const detectBrowsers = (): BrowserProfile[] => {
    const profiles: BrowserProfile[] = [];
    const localAppData = process.env.LOCALAPPDATA; // For Chromium User Data
    const appData = process.env.APPDATA; // For Firefox profiles.ini (Roaming)
    const programFiles = process.env.ProgramFiles;
    const programFilesX86 = process.env['ProgramFiles(x86)'];

    if (!localAppData) return profiles;

    for (const [name, info] of Object.entries(BROWSERS)) {
        // Find executable
        let exePath = path.join(programFiles || 'C:\\Program Files', info.executable);
        if (!fs.existsSync(exePath) && programFilesX86) {
            exePath = path.join(programFilesX86, info.executable);
        }
        
        // Whale might be in LocalAppData
        if (!fs.existsSync(exePath) && name === 'Whale') {
             exePath = path.join(localAppData, info.executable);
        }

        if (!fs.existsSync(exePath)) continue;

        if (info.type === 'chromium') {
            // Parse Local State for profiles (Chromium based)
            const userDataPath = path.join(localAppData, info.userData);
            const localStatePath = path.join(userDataPath, 'Local State');

            if (fs.existsSync(localStatePath)) {
                try {
                    const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
                    const infoCache = localState.profile?.info_cache;

                    if (infoCache) {
                        for (const [profileId, profileData] of Object.entries(infoCache)) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const data = profileData as any;
                            profiles.push({
                                browserName: name as any,
                                profileName: profileId,
                                displayName: data.name || profileId,
                                executablePath: exePath,
                            });
                        }
                    } else {
                         // Fallback
                         profiles.push({
                            browserName: name as any,
                            profileName: 'Default',
                            displayName: 'Default',
                            executablePath: exePath,
                        });
                    }
                } catch (e) {
                    logger.error(`Failed to parse Local State for ${name}: ${(e as Error).message}`);
                }
            }
        } else if (info.type === 'firefox' && appData) {
            // Parse profiles.ini for Firefox
            const profilesIniPath = path.join(appData, info.userData, 'profiles.ini');
            if (fs.existsSync(profilesIniPath)) {
                try {
                    const content = fs.readFileSync(profilesIniPath, 'utf8');
                    // Simple INI parsing: look for Name=... sections
                    const lines = content.split(/\r?\n/);
                    let currentName = '';
                    
                    for (const line of lines) {
                        if (line.startsWith('Name=')) {
                            currentName = line.split('=')[1].trim();
                            if (currentName) {
                                profiles.push({
                                    browserName: 'Firefox',
                                    profileName: currentName,
                                    displayName: currentName,
                                    executablePath: exePath,
                                });
                            }
                        }
                    }
                } catch (e) {
                    logger.error(`Failed to parse profiles.ini for Firefox: ${(e as Error).message}`);
                }
            } else {
                // Determine if profiles.ini missing, just add default
                 profiles.push({
                    browserName: 'Firefox',
                    profileName: 'default',
                    displayName: 'Default',
                    executablePath: exePath,
                });
            }
        }
    }

    return profiles;
};

export const getSupportedBrowserNames = (): string[] => {
    return Object.keys(BROWSERS);
};

export const launchBrowser = (profile: BrowserProfile | null, url: string): void => {
    if (!profile) {
        // System Default
        spawn('cmd', ['/c', 'start', '""', `"${url}"`], { windowsVerbatimArguments: true, detached: true });
        return;
    }

    const args = [url];
    
    if (profile.browserName === 'Firefox') {
        // Firefox uses -P "Profile Name"
        args.push('-P');
        args.push(profile.profileName);
    } else {
        // Chromium based
        if (profile.profileName !== 'Default' || profile.browserName !== 'Edge') {
             args.push(`--profile-directory=${profile.profileName}`);
        }
    }

    logger.info(`Launching ${profile.browserName} (${profile.displayName})...`);
    spawn(profile.executablePath, args, { detached: true });
};

export const getBrowserNameFromPath = (executablePath: string | undefined): string => {
    if (!executablePath) return 'Unknown';
    if (executablePath === 'system_default') return '시스템 기본값';

    const lowerPath = executablePath.toLowerCase();
    for (const [name, info] of Object.entries(BROWSERS)) {
        if (lowerPath.includes(info.executable.split('\\').pop()!.toLowerCase())) {
            return name;
        }
    }
    return 'Default';
};

