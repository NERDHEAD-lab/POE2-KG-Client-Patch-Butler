import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { getInstallPath } from '../utils/registry.js';
import { getAppVersion } from '../utils/version.js';
import { getLastInstallPath, setLastInstallPath } from '../utils/config.js';
import { PathInput } from './PathInput.js';

interface InitProps {
    onDone: (installPath: string, version: string) => void;
    onExit: () => void;
    onUpdate?: () => void;
    onStatusChange?: (status: 'LOADING' | 'CONFIRM' | 'INPUT') => void;
}

const Init: React.FC<InitProps> = ({ onDone, onExit, onUpdate, onStatusChange }) => {
    const [status, setStatus] = useState<'LOADING' | 'CONFIRM' | 'INPUT'>('LOADING');
    const [installPath, setInstallPath] = useState<string>('');
    const [version, setVersion] = useState<string>('Checking...'); // 버전 확인 중

    useEffect(() => {
        if (onStatusChange) {
            onStatusChange(status);
        }
    }, [status, onStatusChange]);

    useEffect(() => {
        const init = async () => {
            try {
                const appVersion = getAppVersion();
                setVersion(appVersion);

                const savedPath = getLastInstallPath();
                if (savedPath) {
                    setInstallPath(savedPath);
                    setStatus('CONFIRM');
                    return;
                }

                const regPath = await getInstallPath();
                if (regPath) {
                    setInstallPath(regPath);
                    setStatus('CONFIRM');
                } else {
                    setStatus('INPUT');
                }
            } catch (err) {
                setStatus('INPUT');
            }
        };
        init();
    }, []);

    const handlePathSet = (path: string) => {
        setInstallPath(path);
        setLastInstallPath(path);
    };

    useInput((input, key) => {
        if (status === 'CONFIRM') {
            if (key.return) {
                handlePathSet(installPath);
                onDone(installPath, version);
            } else if (input === 'e' || input === 'E') {
                setStatus('INPUT');
            } else if (input === 'q' || input === 'Q') {
                onExit();
            } else if ((input === 'u' || input === 'U') && onUpdate) {
                onUpdate();
            }
        }
    });

    if (status === 'LOADING') {
        return <Text>초기화 중...</Text>;
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
