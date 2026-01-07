import { logger } from './logger.js';
import { disableAutoDetectRegistry, stopWatcherProcess, isAutoDetectRegistryEnabled } from './autoDetect.js';
import { disableUACBypass, isUACBypassEnabled } from './uac.js';
import { disableSplash, isSplashEnabled } from './splash.js';
import { setSilentModeEnabled, setAutoLaunchGameEnabled, setBackupEnabled, getSilentModeEnabled, getAutoLaunchGameEnabled, getBackupEnabled } from './config.js';


export type CleanupTarget = 'registry' | 'uac' | 'splash' | 'config' | 'run' | 'all';

export async function performFullCleanup(target: CleanupTarget = 'all'): Promise<void> {
    if (target === 'all') logger.info('모든 설정에 대한 전체 정리를 시작합니다...');

    try {
        // 1. Disable Auto Detect & Stop Watcher
        if (target === 'all' || target === 'registry') {
            if (await isAutoDetectRegistryEnabled()) {
                logger.info('자동 감지 설정을 정리하는 중입니다...');
                await disableAutoDetectRegistry();
                await stopWatcherProcess();
            } else {
                await stopWatcherProcess(); 
            }
        }
    } catch (e) {
        logger.error(`자동 감지 설정 정리 실패: ${e}`);
    }

    try {
        // 2. Disable UAC Bypass
        if (target === 'all' || target === 'uac') {
            if (await isUACBypassEnabled()) {
                 logger.info('UAC 우회 설정을 정리하는 중입니다...');
                 await disableUACBypass();
            }
        }
    } catch (e) {
        logger.error(`UAC 우회 설정 정리 실패: ${e}`);
    }

    try {
        // 3. Disable Splash Screen
        if (target === 'all' || target === 'splash') {
            if (await isSplashEnabled()) {
                logger.info('스플래시 스크린 설정을 정리하는 중입니다...');
                await disableSplash();
            }
        }
    } catch (e) {
        logger.error(`스플래시 스크린 설정 정리 실패: ${e}`);
    }

    try {
        // 4. Reset Config Flags
        if (target === 'all' || target === 'config') {
            const anyConfigEnabled = getSilentModeEnabled() || getAutoLaunchGameEnabled() || getBackupEnabled();
            
            if (anyConfigEnabled) {
                logger.info('환경 설정 플래그를 초기화하는 중입니다...');
                setSilentModeEnabled(false);
                setAutoLaunchGameEnabled(false);
                setBackupEnabled(false);
            }
        }
    } catch (e) {
        logger.error(`환경 설정 초기화 실패: ${e}`);
    }

    if (target === 'all') logger.success('모든 정리 작업이 완료되었습니다.');
}
