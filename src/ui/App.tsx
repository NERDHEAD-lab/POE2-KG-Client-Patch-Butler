import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import axios from 'axios';
import Init from './Init.js';
import MainMenu from './MainMenu.js';
import CasePatchFailed from './Menu/CasePatchFailed.js';
import CaseExecuteFailed from './Menu/CaseExecuteFailed.js';
import CaseCrashing from './Menu/CaseCrashing.js';
import CaseReportIssue from './Menu/CaseReportIssue.js';
// ... imports
import Sidebar from './Sidebar.js';
import OutputBox from './OutputBox.js';
import { getAppVersion } from '../utils/version.js';
import { checkForUpdate } from '../utils/updater.js';
import { performSelfUpdate } from '../utils/selfUpdate.js';
import { downloadFile } from '../utils/downloader.js';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

type Screen = 'INIT' | 'MAIN_MENU' | 'CASE_1' | 'CASE_2' | 'CASE_3' | 'CASE_0';

interface AppProps {
    initialMode?: 'NORMAL' | 'FIX_PATCH';
}

const App: React.FC<AppProps> = ({ initialMode = 'NORMAL' }) => {
    const { exit } = useApp();
    const { stdout } = useStdout();

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
    const [updateInfo, setUpdateInfo] = useState<{ url: string, version: string } | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [initStatus, setInitStatus] = useState<'LOADING' | 'PROCESS_CHECK' | 'CONFIRM' | 'INPUT' | null>(null);

    React.useEffect(() => {
        // Check for updates
        if (process.env.NODE_ENV !== 'development') {
            checkForUpdate().then(res => {
                if (res.hasUpdate && res.downloadUrl) {
                    setUpdateInfo({ url: res.downloadUrl, version: res.latestVersion });
                }
            });
        }

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
            const tempPath = path.join(os.tmpdir(), `poe2-patch-butler-${updateInfo.version}.exe`);

            const doUpdate = async () => {
                try {
                    await downloadFile(updateInfo.url, tempPath, 'update.exe', (s) => {
                        setDownloadProgress(s.progress);
                    });

                    const { stopWatcherProcess } = await import('../utils/autoDetect.js');
                    await stopWatcherProcess();

                    performSelfUpdate(tempPath);
                } catch (e) {
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

    // Output Message (Toast-like)
    const [outputMsg, setOutputMsg] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setOutputMsg(msg);
        setTimeout(() => setOutputMsg(null), 3000);
    };

    const toggleAutoDetect = async () => {
        const { enableAutoDetectRegistry, disableAutoDetectRegistry, startWatcherProcess, stopWatcherProcess } = await import('../utils/autoDetect.js');

        if (isAutoDetectEnabled) {
            // Turning OFF
            await disableAutoDetectRegistry();
            await stopWatcherProcess();
            setIsAutoDetectEnabled(false);
            showToast('자동 감지 기능을 껐습니다. (Watcher Stopped)');
            return false;
        } else {
            // Turning ON
            await enableAutoDetectRegistry();
            startWatcherProcess();
            setIsAutoDetectEnabled(true);
            showToast('자동 감지 기능을 켰습니다. 업데이트 실패 시 자동으로 해결합니다.');
            return true;
        }
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
                return <Init onDone={handleInitDone} onExit={exit} onStatusChange={setInitStatus} />;
            case 'MAIN_MENU':
                return <MainMenu onSelect={handleMenuSelect} onExit={exit} />;
            case 'CASE_1':
                return <CasePatchFailed installPath={installPath} onGoBack={() => setScreen('MAIN_MENU')} onExit={exit} />;
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

    const isInputActive = screen === 'MAIN_MENU' || (screen === 'INIT' && initStatus !== 'INPUT');

    const sidebarItems = [
        {
            keyChar: 'A',
            description: '오류 자동 감지:',
            initialStatus: <Text color="gray"> Checking...</Text>,
            onInit: async (ctx: any) => {
                const enabled = await import('../utils/autoDetect.js').then(m => m.isAutoDetectRegistryEnabled());
                setIsAutoDetectEnabled(enabled);
                ctx.setStatus(enabled ? <Text color="green"> ON</Text> : <Text color="red"> OFF</Text>);
                if (enabled) {
                    import('../utils/autoDetect.js').then(m => m.restartWatcher());
                }
            },
            onClick: async (ctx: any) => {
                const newState = await toggleAutoDetect();
                ctx.setStatus(newState ? <Text color="green"> ON</Text> : <Text color="red"> OFF</Text>);
            }
        },
        {
            keyChar: 'P',
            description: '패치노트 확인',
            onClick: () => handleOpenPatchNotes()
        },
        {
            keyChar: 'U',
            description: '',
            initialVisible: false,
            onInit: async (ctx: any) => {
                if (process.env.NODE_ENV !== 'development') {
                    const res = await checkForUpdate();
                    if (res.hasUpdate && res.downloadUrl) {
                        setUpdateInfo({ url: res.downloadUrl, version: res.latestVersion });
                        ctx.setVisible(true);
                        ctx.setStatus(<Text color="green">업데이트 가능!</Text>);
                    }
                }
            },
            onClick: () => handleUpdate()
        }
    ];

    return (
        <Box flexDirection="column" padding={1} minHeight={stdout?.rows}>
            {/* Header */}
            <Box flexDirection="column" marginBottom={1}>
                <Text color="yellow">POE2 카카오게임즈 클라이언트 오류 해결 마법사 v{appVersion}</Text>

                {/* Server Notice */}

            </Box>

            {/* Main Layout: Row [Content | Sidebar] */}
            <Box flexDirection="row" flexGrow={1} alignItems="stretch">
                {/* Main Content Info */}
                <Box flexDirection="column" flexGrow={1}>
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
                    isActive={isInputActive}
                    items={sidebarItems} />
            </Box>

            {/* Footer Area */}
            <Box marginTop={0} flexDirection="column">

                {/* Output Box (Toast) */}
                <OutputBox message={outputMsg} />

                <Box marginTop={0} flexDirection="column">
                    <Text color="gray">POE2 <Text color="#E06C75">'Transferred a partial file'</Text> 문제 해결 기원 <Text color="#E06C75">{getDayCount()}일차</Text></Text>
                    <Text color="gray">powered by NERDHEAD ( https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler )</Text>
                </Box>
            </Box>
        </Box >
    );
};

export default App;
