import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import axios from 'axios';
import Init from './Init.js';
import MainMenu from './MainMenu.js';
import CasePatchFailed from './Menu/CasePatchFailed.js';
import CaseExecuteFailed from './Menu/CaseExecuteFailed.js';
import CaseCrashing from './Menu/CaseCrashing.js';
import CaseReportIssue from './Menu/CaseReportIssue.js';
import AutoDetectNotice from './AutoDetectNotice.js';
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
                    // Simple sanitization: 
                    // 1. Trim whitespace
                    // 2. Remove non-printable characters (except slightly common ones like newline)
                    // 3. Limit length to prevent UI overflow attacks
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
        const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
        spawn('cmd', ['/c', 'start', url], { windowsVerbatimArguments: true });
    };

    // Auto-detect toggle
    const [isAutoDetectEnabled, setIsAutoDetectEnabled] = useState(false);
    const [showAutoDetectMsg, setShowAutoDetectMsg] = useState(false);

    React.useEffect(() => {
        const initAutoDetect = async () => {
            const enabled = await import('../utils/autoDetect.js').then(m => m.isAutoDetectRegistryEnabled());
            setIsAutoDetectEnabled(enabled);
            if (enabled) {
                // Ensure watcher is running/restarted with correct binary
                import('../utils/autoDetect.js').then(m => m.restartWatcher());
            }
        };
        initAutoDetect();
    }, []);

    const toggleAutoDetect = async () => {
        const { enableAutoDetectRegistry, disableAutoDetectRegistry, startWatcherProcess, stopWatcherProcess } = await import('../utils/autoDetect.js');

        if (isAutoDetectEnabled) {
            // Turning OFF
            await disableAutoDetectRegistry();
            await stopWatcherProcess();
            setIsAutoDetectEnabled(false);
            setShowAutoDetectMsg(true);
            setTimeout(() => setShowAutoDetectMsg(false), 3000);
        } else {
            // Turning ON
            await enableAutoDetectRegistry();
            startWatcherProcess();
            setIsAutoDetectEnabled(true);
            setShowAutoDetectMsg(true);
            setTimeout(() => setShowAutoDetectMsg(false), 3000);
        }
    };

    useInput((input, key) => {
        const isNotInputMode = screen === 'MAIN_MENU' || (screen === 'INIT' && initStatus !== 'INPUT');

        if (isNotInputMode) {
            if (input === 'u' || input === 'U') {
                handleUpdate();
            }
            if (input === 'p' || input === 'P') {
                handleOpenPatchNotes();
            }
            if (input === 'a' || input === 'A') {
                toggleAutoDetect();
            }
        }
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

    return (
        <Box flexDirection="column" padding={1} minHeight={stdout?.rows}>
            {/* Header */}
            <Box flexDirection="column" marginBottom={1}>
                <Text color="yellow">POE2 카카오게임즈 클라이언트 오류 해결 마법사 v{appVersion}</Text>
                <Box borderStyle="single" borderColor="red" paddingX={1} flexDirection="column">
                    <Text color="red">카카오야 제발 일해라</Text>
                    <Text>POE2 카카오게임즈 클라이언트 정상화 기원 <Text bold color="red">최초 발생일로 부터 {getDayCount()}일차</Text></Text>
                </Box>
                {/* Server Notice */}
                {serverNotice && (
                    <Box flexDirection="column">
                        <Box borderStyle="single" borderColor="white" paddingX={1} marginTop={0} flexDirection="column">
                            <Text>{serverNotice}</Text>
                        </Box>
                        <Box position="absolute" marginTop={0} marginLeft={2}>
                            <Text> 공지 </Text>
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Body */}
            <Box flexDirection="column" flexGrow={1}>
                {renderBody()}
            </Box>

            {/* Footer */}
            <Box marginTop={1} flexDirection="column">
                {updateInfo && !isUpdating ? (
                    <AutoDetectNotice isEnabled={isAutoDetectEnabled} showMsg={showAutoDetectMsg} baseColor="green" />
                ) : (
                    <AutoDetectNotice isEnabled={isAutoDetectEnabled} showMsg={showAutoDetectMsg} baseColor="gray" />
                )}

                {updateInfo ? (
                    <Text color={screen === 'INIT' && initStatus === 'INPUT' ? 'gray' : 'green'}>
                        새 업데이트가 있습니다! [{appVersion} {'->'} {updateInfo.version}]
                        {screen === 'MAIN_MENU' || (screen === 'INIT' && initStatus === 'CONFIRM')
                            ? <Text> 업데이트 하려면 <Text bold color="yellow">U</Text>를 눌러주세요</Text>
                            : (screen === 'INIT' && initStatus === 'INPUT'
                                ? <Text> (설치경로 수정중)</Text>
                                : <Text> (메인메뉴에서 업데이트 가능)</Text>
                            )
                        }
                    </Text>
                ) : (
                    !isUpdating && (
                        <Text color="gray">
                            패치노트를 확인 하려면 <Text bold color="yellow">P</Text>를 눌러주세요
                        </Text>
                    )
                )}
                <Box marginTop={0}>
                    <Text color="gray">powered by NERDHEAD ( https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler )</Text>
                </Box>
            </Box>
        </Box >
    );
};

export default App;
