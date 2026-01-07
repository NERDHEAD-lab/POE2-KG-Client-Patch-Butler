import { logger } from './logger.js';
import { disableAutoDetectRegistry, stopWatcherProcess, isAutoDetectRegistryEnabled } from './autoDetect.js';
import { disableUACBypass, isUACBypassEnabled } from './uac.js';
import { disableSplash, isSplashEnabled } from './splash.js';
import { setSilentModeEnabled, setAutoLaunchGameEnabled, setBackupEnabled, getSilentModeEnabled, getAutoLaunchGameEnabled, getBackupEnabled } from './config.js';


export type CleanupTarget = 'registry' | 'uac' | 'splash' | 'config' | 'run' | 'all';

export async function performFullCleanup(target: CleanupTarget = 'all'): Promise<void> {
    if (target === 'all') logger.info('Performing full cleanup of all settings...');

    try {
        // 1. Disable Auto Detect & Stop Watcher
        if (target === 'all' || target === 'registry') {
            if (await isAutoDetectRegistryEnabled()) {
                logger.info('Cleaning up Auto Detect settings...');
                await disableAutoDetectRegistry();
                await stopWatcherProcess();
            } else {
                await stopWatcherProcess(); 
            }
        }
    } catch (e) {
        logger.error(`Failed to cleanup Auto Detect: ${e}`);
    }

    try {
        // 2. Disable UAC Bypass
        if (target === 'all' || target === 'uac') {
            if (await isUACBypassEnabled()) {
                 logger.info('Cleaning up UAC Bypass settings...');
                 await disableUACBypass();
            }
        }
    } catch (e) {
        logger.error(`Failed to cleanup UAC Bypass: ${e}`);
    }

    try {
        // 3. Disable Splash Screen
        if (target === 'all' || target === 'splash') {
            if (await isSplashEnabled()) {
                logger.info('Cleaning up Splash Screen settings...');
                await disableSplash();
            }
        }
    } catch (e) {
        logger.error(`Failed to cleanup Splash Screen: ${e}`);
    }

    try {
        // 4. Reset Config Flags
        if (target === 'all' || target === 'config') {
            const anyConfigEnabled = getSilentModeEnabled() || getAutoLaunchGameEnabled() || getBackupEnabled();
            
            if (anyConfigEnabled) {
                logger.info('Resetting configuration flags...');
                setSilentModeEnabled(false);
                setAutoLaunchGameEnabled(false);
                setBackupEnabled(false);
            }
        }
    } catch (e) {
        logger.error(`Failed to reset configs: ${e}`);
    }

    if (target === 'all') logger.success('Full cleanup completed.');
}
