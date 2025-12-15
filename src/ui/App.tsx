import React, { useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import Init from './Init.js';
import MainMenu from './MainMenu.js';
import CasePatchFailed from './Menu/CasePatchFailed.js';
import CaseExecuteFailed from './Menu/CaseExecuteFailed.js';
import CaseCrashing from './Menu/CaseCrashing.js';
import { getAppVersion } from '../utils/version.js';
import { checkForUpdate } from '../utils/updater.js';
import { performSelfUpdate } from '../utils/selfUpdate.js';
import { downloadFile } from '../utils/downloader.js';
import path from 'path';
import os from 'os';

type Screen = 'INIT' | 'MAIN_MENU' | 'CASE_1' | 'CASE_2' | 'CASE_3' | 'CASE_0';

const App: React.FC = () => {
    const { exit } = useApp();
    const { stdout } = useStdout();
    const [screen, setScreen] = useState<Screen>('INIT');
    const [installPath, setInstallPath] = useState('');
    const [appVersion, setAppVersion] = useState(getAppVersion());
    const [updateInfo, setUpdateInfo] = useState<{ url: string, version: string } | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [initStatus, setInitStatus] = useState<'LOADING' | 'CONFIRM' | 'INPUT' | null>(null);

    React.useEffect(() => {
        if (process.env.NODE_ENV !== 'development') {
            checkForUpdate().then(res => {
                if (res.hasUpdate && res.downloadUrl) {
                    setUpdateInfo({ url: res.downloadUrl, version: res.latestVersion });
                }
            });
        }
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
                    performSelfUpdate(tempPath);
                } catch (e) {
                    // Update failed, reset?
                    setIsUpdating(false);
                }
            };
            doUpdate();
        }
    };

    useInput((input, key) => {
        // Handle update shortcut 'u' only in MAIN_MENU (Init handles its own)
        if (screen === 'MAIN_MENU' && (input === 'u' || input === 'U')) {
            handleUpdate();
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

    const handleInitDone = (path: string, version: string) => {
        setInstallPath(path);
        setAppVersion(version);
        setScreen('MAIN_MENU');
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
                return <Init onDone={handleInitDone} onExit={exit} onUpdate={updateInfo ? handleUpdate : undefined} onStatusChange={setInitStatus} />;
            case 'MAIN_MENU':
                return <MainMenu onSelect={handleMenuSelect} onExit={exit} />;
            case 'CASE_1':
                return <CasePatchFailed installPath={installPath} onGoBack={() => setScreen('MAIN_MENU')} onExit={exit} />;
            case 'CASE_2':
                return <CaseExecuteFailed installPath={installPath} onGoBack={() => setScreen('MAIN_MENU')} onExit={exit} />;
            case 'CASE_3':
                return <CaseCrashing onGoBack={() => setScreen('MAIN_MENU')} />;
            case 'CASE_0':
                return (
                    <Box flexDirection="column">
                        <Text>브라우저에서 GitHub Issues 페이지를 엽니다...</Text>
                        <Text color="blue" underline>https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler/issues</Text>
                        {/* URL 자동 열기 */}
                        <Case0Opener
                            onExit={() => { }}
                            onGoBack={() => setScreen('MAIN_MENU')}
                        />
                    </Box>
                );
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
            </Box>

            {/* Body */}
            <Box flexDirection="column" flexGrow={1}>
                {renderBody()}
            </Box>

            {/* Footer */}
            <Box marginTop={1} flexDirection="column">
                {updateInfo && !isUpdating && (
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
                )}
                <Text color="gray">powered by NERDHEAD ( https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler )</Text>
            </Box>
        </Box>
    );
};

const Case0Opener: React.FC<{ onExit: () => void, onGoBack: () => void }> = ({ onGoBack }) => {
    // Open URL once when mounted
    React.useEffect(() => {
        const url = 'https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler/issues';
        const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
        import('child_process').then(cp => {
            cp.spawn('cmd', ['/c', 'start', url], { windowsVerbatimArguments: true });
        });
    }, []);

    useInput(() => onGoBack());

    return (
        <Box marginTop={1}>
            <Text>(초기 메뉴로 돌아가려면 아무 키나 누르세요)</Text>
        </Box>
    );
};

export default App;
