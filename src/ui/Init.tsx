import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { getInstallPath } from '../utils/registry.js';
import { getAppVersion } from '../utils/version.js';
import { getLastInstallPath, setLastInstallPath, getSilentModeEnabled } from '../utils/config.js';
import { isProcessRunning } from '../utils/process.js';
import { PathInput } from './PathInput.js';

interface InitProps {
    onDone: (installPath: string, version: string) => void;
    onExit: () => void;
    onStatusChange?: (status: 'LOADING' | 'CONFIRM' | 'INPUT') => void;
    onPathDetected?: (path: string) => void;
    isAutoFix?: boolean;
}

const Init: React.FC<InitProps> = ({ onDone, onExit, onStatusChange, onPathDetected, isAutoFix = false }) => {
    const [status, setStatus] = useState<'LOADING' | 'PROCESS_CHECK' | 'CONFIRM' | 'INPUT'>('LOADING');
    const [installPath, setInstallPath] = useState<string>('');
    const [version, setVersion] = useState<string>('Checking...'); // 버전 확인 중

    useEffect(() => {
        if (onStatusChange && (status === 'LOADING' || status === 'CONFIRM' || status === 'INPUT')) {
            onStatusChange(status);
        }
    }, [status, onStatusChange]);

    const checkProcessAndInit = async () => {
        const isRunning = await isProcessRunning('POE2_Launcher.exe');
        if (isRunning) {
            setStatus('PROCESS_CHECK');
        } else {
            // Process not running, proceed to init
            init();
        }
    };

    const init = async () => {
        try {
            const appVersion = getAppVersion();
            setVersion(appVersion);

            const savedPath = getLastInstallPath();
            if (savedPath) {
                setInstallPath(savedPath);
                if (onPathDetected) onPathDetected(savedPath);
                setStatus('CONFIRM');
                return;
            }

            const regPath = await getInstallPath();
            if (regPath) {
                setInstallPath(regPath);
                if (onPathDetected) onPathDetected(regPath);
                setStatus('CONFIRM');
            } else {
                setStatus('INPUT');
            }
        } catch (err) {
            setStatus('INPUT');
        }
    };

    useEffect(() => {
        checkProcessAndInit();
    }, []);

    const handlePathSet = (path: string) => {
        setInstallPath(path);
        setLastInstallPath(path);
    };

    // Auto Confirm for Silent Mode
    useEffect(() => {
        if (status === 'CONFIRM' && isAutoFix && getSilentModeEnabled()) {
            handlePathSet(installPath);
            onDone(installPath, version);
        }
    }, [status, isAutoFix, installPath, version, onDone]);

    useInput((input, key) => {
        if (status === 'PROCESS_CHECK') {
            if (key.return) {
                // Retry check
                checkProcessAndInit();
            } else if (input === 'q' || input === 'Q') {
                onExit();
            }
        } else if (status === 'CONFIRM') {
            if (key.return) {
                handlePathSet(installPath);
                onDone(installPath, version);
            } else if (input === 'e' || input === 'E') {
                setStatus('INPUT');
            } else if (input === 'q' || input === 'Q') {
                onExit();
            }
        }
    });

    if (status === 'LOADING') {
        return <Text>초기화 중...</Text>;
    }

    if (status === 'PROCESS_CHECK') {
        return (
            <Box flexDirection="column" borderColor="red" borderStyle="single" padding={1}>
                <Text color="red" bold>⚠️ 경고: POE2_Launcher.exe가 실행 중입니다.</Text>
                <Text>파일 패치를 위해 런처를 완전히 종료해야 합니다.</Text>
                <Text>작업 관리자(Ctrl+Shift+Esc)에서 프로세스가 정상적으로 종료될 때 까지 대기해주세요. (0 ~ 5분이 소요 될 수 있습니다)</Text>
                <Box marginTop={1}>
                    <Text>종료 후 다시 확인하려면 <Text bold color="green">Enter</Text></Text>
                    <Text>프로그램을 종료하려면 <Text bold color="red">Q</Text></Text>
                </Box>
            </Box>
        );
    }

    if (status === 'INPUT') {
        return (
            <PathInput
                initialPath={installPath}
                onSubmit={(path) => {
                    handlePathSet(path);
                    setStatus('CONFIRM');
                }}
            />
        );
    }

    return (
        <Box flexDirection="column">
            <Text>설치 경로를 찾았습니다: <Text color="green">{installPath}</Text></Text>
            <Text>이 경로가 맞으면 <Text bold color="cyan">Enter</Text>, 수정하려면 <Text bold color="cyan">E</Text>, 종료하려면 <Text bold color="cyan">Q</Text>를 누르세요.</Text>
        </Box>
    );
};

export default Init;
