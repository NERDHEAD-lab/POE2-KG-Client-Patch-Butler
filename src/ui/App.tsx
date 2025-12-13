import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { getInstallPath } from '../utils/registry.js';
import { getLastInstallPath, setLastInstallPath } from '../utils/config.js';
import { parseLog, LogParseResult } from '../utils/logParser.js';
import { downloadFiles, DownloadProgress } from '../utils/downloader.js';
import { PathInput } from './PathInput.js';
import { ProgressBar } from './ProgressBar.js';

type Step = 'INIT' | 'CONFIRM_PATH' | 'INPUT_PATH' | 'ANALYZING' | 'DOWNLOADING' | 'DONE' | 'ERROR';

const App: React.FC = () => {
    const { exit } = useApp();
    const [step, setStep] = useState<Step>('INIT');
    const [installPath, setInstallPath] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [logResult, setLogResult] = useState<LogParseResult | null>(null);
    const [progressMap, setProgressMap] = useState<Record<string, number>>({});

    useEffect(() => {
        const init = async () => {
            try {
                const savedPath = getLastInstallPath();
                if (savedPath) {
                    setInstallPath(savedPath);
                    setStep('CONFIRM_PATH');
                    return;
                }

                const regPath = await getInstallPath();
                if (regPath) {
                    setInstallPath(regPath);
                    setStep('CONFIRM_PATH');
                } else {
                    setStep('INPUT_PATH');
                }
            } catch (err) {
                // Fallback to input if registry fails
                setStep('INPUT_PATH');
            }
        };
        init();
    }, []);

    useInput((input, key) => {
        if (step === 'CONFIRM_PATH') {
            if (key.return) {
                setAndSavePath(installPath);
                setStep('ANALYZING');
            } else if (input === 'e' || input === 'E') {
                setStep('INPUT_PATH');
            } else if (input === 'q' || input === 'Q') {
                exit();
            }
        } else if (step === 'DONE' || step === 'ERROR') {
            if (key.return || input === 'q') {
                exit();
            }
        }
    });

    const setAndSavePath = (path: string) => {
        setInstallPath(path);
        setLastInstallPath(path);
    };

    useEffect(() => {
        if (step === 'ANALYZING') {
            const analyze = async () => {
                try {
                    const result = await parseLog(installPath);
                    setLogResult(result);
                    if (result.filesToDownload.length === 0) {
                        setStep('DONE'); // Nothing to download
                    } else {
                        setStep('DOWNLOADING');
                    }
                } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                    setStep('ERROR');
                }
            };
            analyze();
        }
    }, [step, installPath]);

    useEffect(() => {
        if (step === 'DOWNLOADING' && logResult) {
            const download = async () => {
                try {
                    if (!logResult.webRoot) throw new Error('Web root not found in log.');

                    await downloadFiles(
                        logResult.webRoot,
                        logResult.backupWebRoot || logResult.webRoot,
                        logResult.filesToDownload,
                        installPath,
                        (progress: DownloadProgress) => {
                            setProgressMap(prev => ({
                                ...prev,
                                [progress.fileName]: progress.percentage
                            }));
                        }
                    );
                    setStep('DONE');
                } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                    setStep('ERROR');
                }
            };
            download();
        }
    }, [step, logResult, installPath]);

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="yellow">POE2 KG Client Patch Butler</Text>
            <Box marginBottom={1} />

            {step === 'INIT' && <Text>초기화 중... (Initializing...)</Text>}

            {step === 'CONFIRM_PATH' && (
                <Box flexDirection="column">
                    <Text>설치 경로를 찾았습니다: <Text color="green">{installPath}</Text></Text>
                    <Text>이 경로가 맞으면 <Text bold color="cyan">Enter</Text>, 수정하려면 <Text bold color="cyan">E</Text>, 종료하려면 <Text bold color="cyan">Q</Text>를 누르세요.</Text>
                </Box>
            )}

            {step === 'INPUT_PATH' && (
                <PathInput
                    initialPath={installPath}
                    onSubmit={(path) => {
                        setAndSavePath(path);
                        setStep('CONFIRM_PATH');
                    }}
                />
            )}

            {step === 'ANALYZING' && <Text>로그 분석 중... (Analyzing logs...)</Text>}

            {step === 'DOWNLOADING' && (
                <Box flexDirection="column">
                    <Text>파일 다운로드 중...</Text>
                    {logResult?.filesToDownload.map(file => (
                        <ProgressBar key={file} fileName={file} percentage={progressMap[file] || 0} />
                    ))}
                </Box>
            )}

            {step === 'DONE' && (
                <Box flexDirection="column">
                    {logResult?.filesToDownload.length === 0 ? (
                        <Text color="green">다운로드할 파일이 없습니다. (No files to download)</Text>
                    ) : (
                        <Text color="green">모든 파일 다운로드가 완료되었습니다! (All downloads complete)</Text>
                    )}
                    <Text>종료하려면 아무 키나 누르세요.</Text>
                </Box>
            )}

            {step === 'ERROR' && (
                <Box flexDirection="column">
                    <Text color="red">오류 발생 (Error): {error}</Text>
                    <Text>종료하려면 아무 키나 누르세요.</Text>
                </Box>
            )}
        </Box>
    );
};

export default App;
