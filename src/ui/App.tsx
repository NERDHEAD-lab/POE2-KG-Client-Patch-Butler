import React, { useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import Init from './Init.js';
import MainMenu from './MainMenu.js';
import CasePatchFailed from './Menu/CasePatchFailed.js';
import CaseExecuteFailed from './Menu/CaseExecuteFailed.js';
import CaseCrashing from './Menu/CaseCrashing.js';
import { getAppVersion } from '../utils/version.js';

type Screen = 'INIT' | 'MAIN_MENU' | 'CASE_1' | 'CASE_2' | 'CASE_3' | 'CASE_0';

const App: React.FC = () => {
    const { exit } = useApp();
    const { stdout } = useStdout();
    const [screen, setScreen] = useState<Screen>('INIT');
    const [installPath, setInstallPath] = useState('');
    const [appVersion, setAppVersion] = useState(getAppVersion());

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
        switch (screen) {
            case 'INIT':
                return <Init onDone={handleInitDone} onExit={exit} />;
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
                        {/* Auto open URL logic */}
                        <Case0Opener
                            onExit={() => { /* Stay or go back? User said 'Report Issue means just open URL' */ }}
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
            <Box marginTop={1}>
                <Text color="gray">powered by NERDHEAD (https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler)</Text>
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
