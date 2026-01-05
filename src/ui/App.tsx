import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import axios from 'axios';
import Init from './Init.js';
import MainMenu from './MainMenu.js';
import CasePatchFailed from './Menu/CasePatchFailed.js';
import CaseExecuteFailed from './Menu/CaseExecuteFailed.js';
import CaseCrashing from './Menu/CaseCrashing.js';
import CaseReportIssue from './Menu/CaseReportIssue.js';
import CaseGameRunning from './Menu/CaseGameRunning.js';
import { isProcessRunning } from '../utils/process.js';
import Sidebar, { SidebarItemConfig } from './Sidebar.js';
import OutputBox from './OutputBox.js';
import RainbowText from './RainbowText.js';
import { getAppVersion } from '../utils/version.js';
import { checkForUpdate } from '../utils/updater.js';
import { performSelfUpdate } from '../utils/selfUpdate.js';
import { downloadFile } from '../utils/downloader.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { logger } from '../utils/logger.js';
import { onExtensionEnableAutoLaunch } from '../utils/server.js';
import { getAutoLaunchGameEnabled, setAutoLaunchGameEnabled, getSilentModeEnabled, getBackupEnabled, setBackupEnabled } from '../utils/config.js';
import { isAutoDetectRegistryEnabled, restartWatcher, stopWatcherProcess, enableAutoDetectRegistry, disableAutoDetectRegistry } from '../utils/autoDetect.js';

type Screen = 'INIT' | 'MAIN_MENU' | 'CASE_1' | 'CASE_2' | 'CASE_3' | 'CASE_0' | 'GAME_WARNING';

interface AppProps {
    initialMode?: 'NORMAL' | 'FIX_PATCH';
    serverPort?: number;
}

const App: React.FC<AppProps> = ({ initialMode = 'NORMAL', serverPort = 0 }) => {
    const { exit } = useApp();
    const { stdout } = useStdout();
    const [dimensions, setDimensions] = useState({
        columns: stdout?.columns || 80,
        rows: stdout?.rows || 24
    });

    useEffect(() => {
        const onResize = () => {
            setDimensions({
                columns: stdout?.columns || 80,
                rows: stdout?.rows || 24
            });
        };

        stdout?.on('resize', onResize);
        return () => {
            stdout?.off('resize', onResize);
        };
    }, [stdout]);

    // Always start at INIT to ensure installPath is loaded context correctly
    const [screen, setScreen] = useState<Screen>('INIT');
    const [previousScreen, setPreviousScreen] = useState<Screen | null>(null);
    const [installPath, setInstallPath] = useState('');
    const [appVersion, setAppVersion] = useState(getAppVersion());

    // Game Process Detection State
    const [lastGameStatus, setLastGameStatus] = useState(false);

    // Extension Connection State
    const [isExtensionConnected, setIsExtensionConnected] = useState(false);

    // Unified App States for Sidebar
    const [isAutoDetectEnabled, setIsAutoDetectEnabled] = useState(false);
    const [isSilentModeEnabled, setIsSilentModeEnabled] = useState(false);
    const [isAutoLaunchGameEnabled, setIsAutoLaunchGameEnabled] = useState(false);
    const [isBackupModeEnabled, setIsBackupModeEnabled] = useState(false);

    useEffect(() => {
        // Listen for enabled signal
        onExtensionEnableAutoLaunch(() => {
            logger.info('Auto Launch enabled signal received! Updating UI...');
            setAutoLaunchGameEnabled(true);
            setIsAutoLaunchGameEnabled(true);
        });
    }, []);

    useEffect(() => {
        // Subscribe to extension verification
        import('../utils/server.js').then(({ onExtensionVerified }) => {
            onExtensionVerified(() => {
                setIsExtensionConnected(true);
                // Can initiate auto-launch logic here if needed later
            });
        });
    }, []);

    // Server Notice
    const [serverNotice, setServerNotice] = useState<string | null>(null);

    useEffect(() => {
        const initAppStates = async () => {
            try {
                // Initialize from Registry/Config
                const autoDetect = await isAutoDetectRegistryEnabled();
                const silent = getSilentModeEnabled();
                const autoLaunch = getAutoLaunchGameEnabled();
                const backup = getBackupEnabled();

                setIsAutoDetectEnabled(autoDetect);
                setIsSilentModeEnabled(silent);
                setIsAutoLaunchGameEnabled(autoLaunch);
                setIsBackupModeEnabled(backup);

                if (autoDetect) {
                    logger.info('Registry: Auto-detect ON. Starting watcher process...');
                    await restartWatcher();
                    logger.success('Watcher process started with --watch');
                }
            } catch (e) {
                logger.error('Failed to initialize app states: ' + e);
            }
        };
        initAppStates();
    }, []);

    const handleInitDone = (path: string, version: string) => {
        setInstallPath(path);
        setAppVersion(version);

        if (initialMode === 'FIX_PATCH') {
            setScreen('CASE_1');
        } else {
            setScreen('MAIN_MENU');
        }
    };
    const [updateInfo, setUpdateInfo] = useState<{ url: string, version: string, updateType: 'installer' | 'portable' } | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [initStatus, setInitStatus] = useState<'LOADING' | 'PROCESS_CHECK' | 'CONFIRM' | 'INPUT' | null>(null);

    // Runtime Game Detection Polling
    useEffect(() => {
        const checkGameProcess = async () => {
            // Only poll if we are past the INIT screen and NOT already in the warning screen
            // User requested to start this AFTER Init (Launcher Check) is done.
            if (screen === 'INIT' || screen === 'GAME_WARNING') return;

            const isGameRunning = await isProcessRunning('PathOfExile_KG.exe');

            // Detect OFF -> ON transition
            if (!lastGameStatus && isGameRunning) {
                setPreviousScreen(screen);
                setScreen('GAME_WARNING');
            }

            setLastGameStatus(isGameRunning);
        };

        const intervalId = setInterval(checkGameProcess, 3000); // Check every 3 seconds
        
        // Initial check immediately to set baseline
        checkGameProcess();

        return () => clearInterval(intervalId);
    }, [screen, lastGameStatus]); // Dependencies: re-run if screen changes to avoid stale state issues, though careful with interval

    React.useEffect(() => {
        logger.info(`App Initialized (v${getAppVersion()})` + (serverPort ? ` [Server: ${serverPort}]` : ''));

        // Fetch Server Notice
        const fetchNotice = async () => {
            try {
                const response = await axios.get('https://nerdhead-lab.github.io/POE2-KG-Client-Patch-Butler/notice.txt');
                if (response.status === 200 && response.data) {
                    const rawText = typeof response.data === 'string' ? response.data : String(response.data);
                    const cleanText = rawText.replace(/[^\x20-\x7E\n\r\t\uAC00-\uD7A3]/g, '').trim().slice(0, 5000);

                    if (cleanText.length > 0) {
                        setServerNotice(cleanText);
                    }
                }
            } catch (e) {
                // Ignore parsing errors or network failures
            }
        };
        fetchNotice();
    }, []);

    const handleUpdate = () => {
        if (updateInfo && !isUpdating) {
            setIsUpdating(true);
            const tempFileName = updateInfo.updateType === 'installer'
                ? `poe2-patch-butler-setup-${updateInfo.version}.exe`
                : `poe2-patch-butler-${updateInfo.version}.exe`;
            const tempPath = path.join(os.tmpdir(), tempFileName);

            logger.info(`업데이트 다운로드 및 적용 시작: v${updateInfo.version} (${updateInfo.updateType})`);

            const doUpdate = async () => {
                try {
                    await downloadFile(updateInfo.url, tempPath, 'update.exe', (s) => {
                        setDownloadProgress(s.progress);
                    });

                    logger.success('업데이트 다운로드 완료. Watcher 중지 및 자가 업데이트 진행.');

                    const { stopWatcherProcess } = await import('../utils/autoDetect.js');
                    await stopWatcherProcess();

                    performSelfUpdate(tempPath, updateInfo.updateType);
                } catch (e) {
                    logger.error('업데이트 실패: ' + e);
                    setIsUpdating(false);
                }
            };
            doUpdate();
        }
    };

    const handleOpenPatchNotes = () => {
        const url = 'https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler/releases';
        spawn('cmd', ['/c', 'start', url], { windowsVerbatimArguments: true });
    };


    const toggleAutoDetect = async () => {
        if (isAutoDetectEnabled) {
            // Turning OFF
            await disableAutoDetectRegistry();
            await stopWatcherProcess();
            setIsAutoDetectEnabled(false);
            logger.warn('자동 감지 기능을 껐습니다. (Watcher Stopped)');
            return false;
        } else {
            // Turning ON
            try {
                await enableAutoDetectRegistry();
                await restartWatcher(); // Use restart for clean start
                setIsAutoDetectEnabled(true);
                logger.success('자동 감지 기능을 켰습니다. 업데이트 실패 시 자동으로 해결합니다.');
                return true;
            } catch (e) {
                logger.error('자동 감지 설정 실패: ' + e);
                return false;
            }
        }
    };

    const handleAppExit = async () => {
        logger.info('종료 중... 서버를 중지합니다.');
        try {
            const { stopServer } = await import('../utils/server.js');
            stopServer();
            logger.success('정리 완료.');
        } catch (e) {
            // Ignore exit errors
        }
        exit();
        process.exit(0);
    };

    useInput((input, key) => {
        // Only handle Global inputs if any (None for now, Sidebar handles its own)
    });

    const getDayCount = () => {
        // 최초 버그 발생일
        // ref: https://kakaogames.oqupie.com/portal/2881/article/73761
        const startDate = new Date('2024-12-07');
        const today = new Date();
        const diffTime = today.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 1; // 1일차 시작
    };

    const handleMenuSelect = (option: number) => {
        switch (option) {
            case 1: setScreen('CASE_1'); break;
            case 2: setScreen('CASE_2'); break;
            case 3: setScreen('CASE_3'); break;
            case 0: setScreen('CASE_0'); break;
        }
    };

    const handleIgnoreGameWarning = () => {
        if (previousScreen) {
            setScreen(previousScreen);
            setPreviousScreen(null);
            // We set lastGameStatus to true naturally by the next poll, or we can force it here to prevent immediate re-trigger if logic was synchronous
            setLastGameStatus(true); 
        } else {
            setScreen('MAIN_MENU'); // Fallback
        }
    };

    const renderBody = () => {
        if (isUpdating) {
            return (
                <Box flexDirection="column" alignItems="center" justifyContent="center">
                    <Text color="green">새로운 버전 다운로드 중... {downloadProgress}%</Text>
                    <Text>다운로드 완료 후 자동으로 재시작됩니다.</Text>
                </Box>
            );
        }

        switch (screen) {
            case 'INIT':
                return <Init onDone={handleInitDone} onExit={handleAppExit} onStatusChange={setInitStatus} onPathDetected={(path) => setInstallPath(path)} isAutoFix={initialMode === 'FIX_PATCH'} />;
            case 'MAIN_MENU':
                return <MainMenu onSelect={handleMenuSelect} onExit={handleAppExit} />;
            case 'CASE_1':
                // Pass auto-launch config
                const { getAutoLaunchGameEnabled } = require('../utils/config.js');
                return <CasePatchFailed installPath={installPath} onGoBack={() => setScreen('MAIN_MENU')} onExit={handleAppExit} isAutoFix={initialMode === 'FIX_PATCH'} isAutoLaunch={getAutoLaunchGameEnabled()} serverPort={serverPort} />;
            case 'CASE_2':
                return <CaseExecuteFailed installPath={installPath} onGoBack={() => setScreen('MAIN_MENU')} onExit={handleAppExit} />;
            case 'CASE_3':
                return <CaseCrashing onGoBack={() => setScreen('MAIN_MENU')} />;
            case 'CASE_0':
                return <CaseReportIssue onGoBack={() => setScreen('MAIN_MENU')} />;
            case 'GAME_WARNING':
                return <CaseGameRunning onIgnore={handleIgnoreGameWarning} onExit={handleAppExit} />;
            default:
                return null;
        }
    };

    const isInputActive = !(screen === 'INIT' && initStatus === 'INPUT');

    const sidebarItems: SidebarItemConfig[] = React.useMemo(() => [
        {
            keyChar: 'A',
            description: '오류 자동 감지:',
            initialStatus: isAutoDetectEnabled ? <Text color="green"> ON</Text> : <Text color="red"> OFF</Text>,
            onClick: async (ctx: any) => {
                const newState = await toggleAutoDetect();
                setIsAutoDetectEnabled(newState);
                ctx.setStatus(newState ? <Text color="green"> ON</Text> : <Text color="red"> OFF</Text>);
            }
        },
        {
            keyChar: 'S',
            description: '자동 진행 모드:',
            isChild: true,
            disabled: !isAutoDetectEnabled,
            initialStatus: isSilentModeEnabled ? <Text color="green"> ON</Text> : <Text color="red"> OFF</Text>,
            onClick: async (ctx: any) => {
                const { setSilentModeEnabled } = await import('../utils/config.js');
                const newState = !isSilentModeEnabled;
                setSilentModeEnabled(newState);
                setIsSilentModeEnabled(newState);
                ctx.setStatus(newState ? <Text color="green"> ON</Text> : <Text color="red"> OFF</Text>);
            }
        },
        {
            keyChar: 'G',
            description: '게임 자동 시작:',
            isChild: true,
            disabled: !isAutoDetectEnabled,
            initialStatus: isAutoLaunchGameEnabled ? <Text color="green"> ON</Text> : <Text color="red"> OFF</Text>,
            onClick: async (ctx: any) => {
                if (isAutoLaunchGameEnabled) {
                    setAutoLaunchGameEnabled(false);
                    setIsAutoLaunchGameEnabled(false);
                    ctx.setStatus(<Text color="red"> OFF</Text>);
                } else {
                    spawn('cmd', ['/c', 'start', '""', `\"https://nerdhead-lab.github.io/POE2-quick-launch-for-kakao/butler.html?ext_port=${serverPort}&action=enable_auto_launch\"`], { windowsVerbatimArguments: true });
                }
            }
        },
        {
            keyChar: 'B',
            description: '패치 백업 모드:',
            initialStatus: isBackupModeEnabled ? <Text color="green"> ON</Text> : <Text color="red"> OFF</Text>,
            onClick: async (ctx: any) => {
                const newState = !isBackupModeEnabled;
                setBackupEnabled(newState);
                setIsBackupModeEnabled(newState);

                if (!newState && installPath) {
                    const { deleteBackup } = await import('../utils/restore.js');
                    await deleteBackup(installPath);
                }

                const { notifyBackupCreated } = await import('../utils/backupObserver.js');
                notifyBackupCreated();

                ctx.setStatus(newState ? <Text color="green"> ON</Text> : <Text color="red"> OFF</Text>);
            }
        },
        {
            keyChar: 'R',
            description: '백업 복구',
            isChild: true,
            initialVisible: false,
            onInit: (ctx: any) => {
                if (!installPath) {
                    // logger.error('설치 경로가 설정되지 않았습니다.');
                    return;
                }

                let unsubscribe: (() => void) | undefined;

                const check = async () => {
                    try {
                        const { getBackupInfo } = await import('../utils/restore.js');
                        const version = await getBackupInfo(installPath);
                        if (version) {
                            ctx.setVisible(true);
                            ctx.setStatus(<Text color="yellow">({version})</Text>);
                        } else {
                            // logger.warn('백업 파일이 존재하지 않습니다.');
                            ctx.setVisible(false);
                        }
                    } catch (e) {
                        ctx.setVisible(false);
                    }
                };

                check();

                import('../utils/backupObserver.js').then(({ subscribeToBackupCreated }) => {
                    unsubscribe = subscribeToBackupCreated(check);
                });

                return () => {
                    if (unsubscribe) unsubscribe();
                };
            },
            onClick: async (ctx: any) => {
                if (!installPath) {
                    logger.error('설치 경로가 설정되지 않았습니다.');
                    return;
                }
                const { restoreBackup } = await import('../utils/restore.js');
                const success = await restoreBackup(installPath);
                if (success) {
                    ctx.setStatus(<Text color="green">복구 완료!</Text>);
                }
            }
        },
        {
            type: 'separator'
        },
        {
            keyChar: 'P',
            description: '패치노트 확인',
            onClick: () => handleOpenPatchNotes()
        },
        {
            keyChar: 'W',
            description: '작동원리',
            onClick: () => {
                spawn('cmd', ['/c', 'start', 'https://nerdhead-lab.github.io/POE2-KG-Client-Patch-Butler?docs=PRINCIPLES.md'], { windowsVerbatimArguments: true });
            }
        },
        {
            keyChar: 'I',
            description: '피드백',
            onClick: () => {
                spawn('cmd', ['/c', 'start', 'https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler/issues'], { windowsVerbatimArguments: true });
            }
        },
        {
            keyChar: 'H',
            description: '자주 묻는 질문',
            onClick: () => {
                spawn('cmd', ['/c', 'start', 'https://nerdhead-lab.github.io/POE2-KG-Client-Patch-Butler?docs=FAQ.md'], { windowsVerbatimArguments: true });
            }
        },
        { type: 'separator' },
        {
            keyChar: '/',
            description: '후원하기',
            onClick: () => {
                spawn('cmd', ['/c', 'start', 'https://nerdhead-lab.github.io/POE2-KG-Client-Patch-Butler?docs=SUPPORT.md'], { windowsVerbatimArguments: true });
            }
        },
        {
            keyChar: 'U',
            description: '',
            initialVisible: false,
            onInit: (ctx: any) => {
                (async () => {
                    if (process.env.NODE_ENV === 'development') {
                        return;
                    }

                    logger.info('업데이트 확인 중...');
                    const res = await checkForUpdate();
                    if (res.hasUpdate && res.downloadUrl) {
                        logger.info(`새 업데이트 발견: v${res.latestVersion}`);
                        setUpdateInfo({ url: res.downloadUrl, version: res.latestVersion, updateType: res.updateType });
                        ctx.setVisible(true);
                        ctx.setStatus(<Text color="green">업데이트 ({appVersion} {'->'} {res.latestVersion})</Text>);
                    } else {
                        logger.info('최신 버전입니다.');
                        // setInitStatus('CONFIRM'); // To allow user to proceed
                    }
                })();
            },
            onClick: () => handleUpdate()
        }
    ], [isAutoDetectEnabled, isSilentModeEnabled, isAutoLaunchGameEnabled, isBackupModeEnabled, installPath, serverPort, appVersion]);

    return (
        <Box flexDirection="column" padding={1} minHeight={dimensions.rows} width={dimensions.columns}>
            {/* Header */}
            <Box flexDirection="column" marginBottom={1}>
                {/* Rainbow Title */}
                <RainbowText>POE2 카카오게임즈 클라이언트 오류 해결 마법사 v{appVersion}</RainbowText>

                {/* Server Notice */}

            </Box>

            {/* Main Layout: Row [Content | Sidebar] */}
            <Box flexDirection="row" flexGrow={1} alignItems="stretch">
                {/* Main Content Info */}
                <Box flexDirection="column" width={Math.max(0, dimensions.columns - 34)}>
                    {/* Server Notice moved here */}
                    {serverNotice && (
                        <Box flexDirection="column" marginBottom={1}>
                            <Box borderStyle="single" borderColor="white" paddingX={1} marginTop={0} flexDirection="column">
                                <Text>{serverNotice}</Text>
                            </Box>
                            <Box position="absolute" marginTop={0} marginLeft={2}>
                                <Text> 공지 </Text>
                            </Box>
                        </Box>
                    )}
                    {renderBody()}
                </Box>

                {/* Sidebar (Right) */}
                <Sidebar
                    key={`${installPath}-${isAutoDetectEnabled}-${isSilentModeEnabled}-${isAutoLaunchGameEnabled}-${isBackupModeEnabled}-${isExtensionConnected}`} // Force remount on foundational state changes
                    isActive={isInputActive}
                    items={sidebarItems} />
            </Box>

            {/* Footer Area */}
            <Box marginTop={0} flexDirection="column">

                {/* Output Box (Toast) */}
                <OutputBox />

                <Box marginTop={0} flexDirection="column">
                    <Text color="gray">POE2 <Text color="#E06C75">'Transferred a partial file'</Text> 문제 해결 기원 <Text color="#E06C75">{getDayCount()}일차</Text></Text>
                    <Text color="gray">powered by NERDHEAD ( https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler )</Text>
                </Box>
            </Box>
        </Box >
    );
};

export default App;
