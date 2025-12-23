import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import axios from 'axios';
import Init from './Init.js';
import MainMenu from './MainMenu.js';
import CasePatchFailed from './Menu/CasePatchFailed.js';
import CaseExecuteFailed from './Menu/CaseExecuteFailed.js';
import CaseCrashing from './Menu/CaseCrashing.js';
import CaseReportIssue from './Menu/CaseReportIssue.js';
import Sidebar from './Sidebar.js';
import OutputBox from './OutputBox.js';
import RainbowText from './RainbowText.js';
import { getAppVersion } from '../utils/version.js';
import { getBackupEnabled, setBackupEnabled } from '../utils/config.js';
import { checkForUpdate } from '../utils/updater.js';
import { performSelfUpdate } from '../utils/selfUpdate.js';
import { downloadFile } from '../utils/downloader.js';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger.js';

type Screen = 'INIT' | 'MAIN_MENU' | 'CASE_1' | 'CASE_2' | 'CASE_3' | 'CASE_0';

interface AppProps {
    initialMode?: 'NORMAL' | 'FIX_PATCH';
}

const App: React.FC<AppProps> = ({ initialMode = 'NORMAL' }) => {
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
    const [installPath, setInstallPath] = useState('');
    const [appVersion, setAppVersion] = useState(getAppVersion());

    // Server Notice
    const [serverNotice, setServerNotice] = useState<string | null>(null);

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
    const hasEnsuredWatcher = React.useRef(false);

    React.useEffect(() => {
        logger.info(`App Initialized (v${getAppVersion()})`);

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

                    const { stopWatcherProcess } = await import('../utils/autoDetectWithTask.js');
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

    // Auto-detect toggle
    const [isAutoDetectEnabled, setIsAutoDetectEnabled] = useState(false);
    const [isAdminDetectEnabled, setIsAdminDetectEnabled] = useState(false);

    const toggleAutoDetect = async () => {
        const TaskDetect = await import('../utils/autoDetectWithTask.js');
        const RegDetect = await import('../utils/autoDetectWithRegistry.js');

        const { stopWatcherProcess } = TaskDetect; // Smart stop works for both

        if (isAutoDetectEnabled) {
            // Turning OFF
            // Only disable Task if it is actually enabled (prevents unnecessary UAC)
            if (await TaskDetect.isAutoDetectTaskEnabled()) {
                await TaskDetect.disableAutoDetectTask();
            }
            // Always try to disable registry
            await RegDetect.disableAutoDetectRegistry();

            await stopWatcherProcess();

            setIsAutoDetectEnabled(false);
            logger.warn('자동 감지 기능을 껐습니다. (Watcher Stopped)');
            return false;
        } else {
            // Turning ON
            try {
                if (isAdminDetectEnabled) {
                    await TaskDetect.enableAutoDetectTask();
                    logger.success('자동 감지 기능을 켰습니다. (관리자 권한 - Task Scheduler)');
                } else {
                    await RegDetect.enableAutoDetectRegistry();
                    RegDetect.startWatcherProcessRegistry(); // Registry mode needs explicit start call usually? 
                    // RegDetect.enable defines registry key. We also need to start process if not running.
                    logger.success('자동 감지 기능을 켰습니다. (일반 권한 - Registry)');
                }
                setIsAutoDetectEnabled(true);
                return true;
            } catch (e) {
                const errStr = String(e);
                logger.error(`설정 실패: ${errStr}`);
                if (isAdminDetectEnabled) {
                    logger.error('관리자 권한 설정을 실패했습니다. 권한 요청을 수락했는지 확인하세요.');
                }
                return false;
            }
        }
    };

    const toggleAdminDetect = async () => {
        const TaskDetect = await import('../utils/autoDetectWithTask.js');
        const RegDetect = await import('../utils/autoDetectWithRegistry.js');
        const { stopWatcherProcess } = TaskDetect;

        const newAdminState = !isAdminDetectEnabled;
        setIsAdminDetectEnabled(newAdminState);

        // If Auto Detect is currently ON, we need to switch implementation immediately
        if (isAutoDetectEnabled) {
            try {
                const isTaskCurrentlyEnabled = await TaskDetect.isAutoDetectTaskEnabled();

                if (newAdminState) {
                    // Switch to Admin (Task)
                    // If we were using Registry, stop it first.
                    if (!isTaskCurrentlyEnabled) {
                        await stopWatcherProcess(false); // User kill, skip UAC if Admin
                        await RegDetect.disableAutoDetectRegistry();
                    }
                    await TaskDetect.enableAutoDetectTask();
                    logger.success('자동 감지 모드 변경: 관리자 권한 (Task Scheduler)');
                } else {
                    // Switch to User (Registry)
                    // If we were using Task, disable it (triggers UAC and kills process)
                    if (isTaskCurrentlyEnabled) {
                        await TaskDetect.disableAutoDetectTask();
                    } else {
                        await stopWatcherProcess();
                    }

                    await RegDetect.enableAutoDetectRegistry();
                    RegDetect.startWatcherProcessRegistry();
                    logger.success('자동 감지 모드 변경: 일반 권한 (Registry)');
                }
            } catch (e) {
                logger.error('모드 변경 실패: ' + e);
                // Revert state if failed? For now just log.
            }
        } else {
            logger.info(`자동 감지 모드 설정 변경: ${newAdminState ? '관리자 권한' : '일반 권한'} (기능이 켜질 때 적용됩니다)`);
        }
        return newAdminState;
    };

    useInput((input, key) => {
        // Only handle Global inputs if any
    });

    const getDayCount = () => {
        // ... same ...
        const startDate = new Date('2024-12-07');
        const today = new Date();
        const diffTime = today.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 1;
    };

    const handleMenuSelect = (option: number) => {
        switch (option) {
            case 1: setScreen('CASE_1'); break;
            case 2: setScreen('CASE_2'); break;
            case 3: setScreen('CASE_3'); break;
            case 0: setScreen('CASE_0'); break;
        }
    };

    const renderBody = () => {
        // ... same ...
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
                return <Init onDone={handleInitDone} onExit={exit} onStatusChange={setInitStatus} onPathDetected={(path) => setInstallPath(path)} />;
            case 'MAIN_MENU':
                return <MainMenu onSelect={handleMenuSelect} onExit={exit} />;
            case 'CASE_1':
                return <CasePatchFailed installPath={installPath} onGoBack={() => setScreen('MAIN_MENU')} onExit={exit} isAutoFix={initialMode === 'FIX_PATCH'} />;
            case 'CASE_2':
                return <CaseExecuteFailed installPath={installPath} onGoBack={() => setScreen('MAIN_MENU')} onExit={exit} />;
            case 'CASE_3':
                return <CaseCrashing onGoBack={() => setScreen('MAIN_MENU')} />;
            case 'CASE_0':
                return <CaseReportIssue onGoBack={() => setScreen('MAIN_MENU')} />;
            default:
                return null;
        }
    };

    const isInputActive = !(screen === 'INIT' && initStatus === 'INPUT');

    const sidebarItems: any[] = [
        {
            keyChar: 'A',
            description: '오류 자동 감지',
            initialStatus: <Text color="gray"> Checking...</Text>,
            onInit: async (ctx: any) => {
                const TaskDetect = await import('../utils/autoDetectWithTask.js');
                const RegDetect = await import('../utils/autoDetectWithRegistry.js');

                const isTask = await TaskDetect.isAutoDetectTaskEnabled();
                const isReg = await RegDetect.isAutoDetectRegistryEnabled();

                const enabled = isTask || isReg;
                const isAdmin = isTask; // If task is on, we are in admin mode (or both, but task takes precedence)

                setIsAutoDetectEnabled(enabled);
                setIsAdminDetectEnabled(isAdmin);

                ctx.setStatus(enabled ? <Text color="green"> ON</Text> : <Text color="red"> OFF</Text>);

                if (enabled) {
                    if (isTask) {
                        if (!hasEnsuredWatcher.current) {
                            hasEnsuredWatcher.current = true;
                            TaskDetect.ensureWatcherRunningTask();
                        }
                    } else {
                        // For registry, we just ensure process is running if we want to be robust
                        // But startWatcherProcessRegistry launches it. 
                        // We can check isWatcherRunning (from TaskDetect which checks PID file)
                        const running = await TaskDetect.isWatcherRunning();
                        if (!running) {
                            RegDetect.startWatcherProcessRegistry();
                        }
                    }
                }
            },
            onClick: async (ctx: any) => {
                const newState = await toggleAutoDetect();
                ctx.setStatus(newState ? <Text color="green"> ON</Text> : <Text color="red"> OFF</Text>);
            }
        },
        {
            keyChar: 'T',
            description: '패치 후 자동실행(관리자 권한)',
            isChild: true,
            initialStatus: <Text color="gray"> Checking...</Text>,
            onInit: async (ctx: any) => {
                // Wait for State init usually? But Sidebar items init in parallel or order?
                // We can rely on the state we JUST set in A? initialization might be async race.
                // Safest to re-check or wait. Effect updates state.
                // However, `onInit` here is called by Sidebar component once.
                // Let's just check the state or re-derive.
                // Since we haven't rendered yet, state might not be flush.
                // But we can check the same logic or just default false and let Render update?
                // Ideally Sidebar shouldn't rely on React State for its internal printed status if it's separate?
                // But `ctx.setStatus` updates the UI.

                // Let's re-derive quickly to be safe/consistent
                const TaskDetect = await import('../utils/autoDetectWithTask.js');
                const isTask = await TaskDetect.isAutoDetectTaskEnabled();
                // If Task is enabled, then Admin Mode is effectively ON.
                // If neither is enabled, we default to FALSE (User preference default).
                // But user wants "Default to Registry" (User mode). So Admin Mode = False by default.

                // If Task is enable -> Admin Mode True.
                // Else -> False.
                ctx.setStatus(isTask ? <Text color="green"> ON</Text> : <Text color="gray"> OFF</Text>);
            },
            onClick: async (ctx: any) => {
                const newState = await toggleAdminDetect();
                ctx.setStatus(newState ? <Text color="green"> ON</Text> : <Text color="gray"> OFF</Text>);
            }
        },
        {
            keyChar: 'B',
            description: '패치 백업 모드:',
            initialStatus: <Text color="gray"> Checking...</Text>,
            onInit: (ctx: any) => {
                const enabled = getBackupEnabled();
                ctx.setStatus(enabled ? <Text color="green"> ON</Text> : <Text color="red"> OFF</Text>);
            },
            onClick: async (ctx: any) => {
                const current = getBackupEnabled();
                const newState = !current;
                setBackupEnabled(newState);

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
        {
            keyChar: 'U',
            description: '',
            initialVisible: false,
            onInit: async (ctx: any) => {
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
                }
            },
            onClick: () => handleUpdate()
        }
    ];

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
                    key={installPath} // Force remount when installPath is ready to refresh async status
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
