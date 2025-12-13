import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import path from 'path';
import { getInstallPath } from '../utils/registry.js';
import { getLastInstallPath, setLastInstallPath } from '../utils/config.js';
import { parseLog, LogParseResult, generateForcePatchResult } from '../utils/logParser.js';
import { downloadFiles, cleanupTempDir } from '../utils/downloader.js';
import { PathInput } from './PathInput.js';
import { ProgressBar } from './ProgressBar.js';

type Step = 'INIT' | 'CONFIRM_PATH' | 'INPUT_PATH' | 'ANALYZING' | 'CONFIRM_FORCE' | 'READY_TO_DOWNLOAD' | 'EDIT_WEBROOT' | 'DOWNLOADING' | 'DONE' | 'ERROR';

const extractVersion = (url: string | null): string | null => {
    if (!url) return null;
    const match = url.match(/\/patch\/([^\/]+)\/?/);
    return match ? match[1] : null;
};

const App: React.FC = () => {
    const { exit } = useApp();
    const [step, setStep] = useState<Step>('INIT');
    const [installPath, setInstallPath] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [logResult, setLogResult] = useState<LogParseResult | null>(null);
    const [fileStates, setFileStates] = useState<Record<string, { status: 'waiting' | 'downloading' | 'done' | 'error', progress: number, error?: Error }>>({});
    const [downloadResult, setDownloadResult] = useState<{ success: boolean; failures: { fileName: string; error: Error }[] } | null>(null);

    const [cleanupStatus, setCleanupStatus] = useState<'pending' | 'cleaning' | 'done' | 'kept'>('pending');

    // WebRoot 수정용 상태
    const [editWebRoot, setEditWebRoot] = useState<string>('');

    useEffect(() => {
        // 초기화: 레지스트리 또는 저장된 설정에서 설치 경로 로드
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
        } else if (step === 'CONFIRM_FORCE') {
            if (input === 'f' || input === 'F') {
                if (logResult) {
                    try {
                        const newResult = generateForcePatchResult(logResult);
                        setLogResult(newResult);

                        const initialStates: any = {};
                        newResult.filesToDownload.forEach(f => {
                            initialStates[f] = { status: 'waiting', progress: 0 };
                        });
                        setFileStates(initialStates);
                        setStep('READY_TO_DOWNLOAD');
                    } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                        setStep('ERROR');
                    }
                }
            } else if (key.return) {
                setStep('DONE');
            } else if (input === 'q' || input === 'Q') {
                exit();
            }
        } else if (step === 'READY_TO_DOWNLOAD') {
            if (key.return) {
                setStep('DOWNLOADING');
            } else if (input === 'e' || input === 'E') {
                if (logResult?.webRoot) {
                    setEditWebRoot(logResult.webRoot);
                    setStep('EDIT_WEBROOT');
                }
            } else if (input === 'q' || input === 'Q') {
                exit();
            }
        } else if (step === 'DONE') {
            if (cleanupStatus === 'pending') {
                if (key.return) {
                    setCleanupStatus('cleaning');
                    cleanupTempDir(installPath).then(() => setCleanupStatus('done'));
                } else if (input === 'q' || input === 'Q' || input === 'n' || input === 'N' || key.escape) {
                    setCleanupStatus('kept');
                }
            } else {
                // 종료 키 처리
                if (input || key.return || key.escape || key.backspace || key.delete) {
                    exit();
                }
            }
        } else if (step === 'ERROR') {
            // Any key exits
            if (input || key.return || key.escape || key.backspace || key.delete) {
                exit();
            }
        }
    });

    const setAndSavePath = (path: string) => {
        try {
            setInstallPath(path);
            setLastInstallPath(path);
        } catch (e) {
            // 저장 실패 시에도 진행에는 문제 없도록 처리
            setInstallPath(path);
        }
    };

    useEffect(() => {
        if (step === 'ANALYZING') {
            const analyze = async () => {
                // UX 개선 및 상태 전환 안정화를 위한 지연
                await new Promise(r => setTimeout(r, 500));

                try {
                    const result = await parseLog(installPath);
                    setLogResult(result);

                    if (!result.hasError || result.filesToDownload.length === 0) {
                        setStep('CONFIRM_FORCE');
                    } else {
                        // 파일 상태 초기화
                        const initialStates: any = {};
                        result.filesToDownload.forEach(f => {
                            initialStates[f] = { status: 'waiting', progress: 0 };
                        });
                        setFileStates(initialStates);
                        setStep('READY_TO_DOWNLOAD');
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

                    const result = await downloadFiles(
                        logResult.webRoot,
                        logResult.backupWebRoot || logResult.webRoot,
                        logResult.filesToDownload,
                        installPath,
                        (status) => {
                            setFileStates(prev => ({
                                ...prev,
                                [status.fileName]: {
                                    status: status.status,
                                    progress: status.progress,
                                    error: status.error
                                }
                            }));
                        }
                    );
                    setDownloadResult(result);
                    setStep('DONE');
                } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                    setStep('ERROR');
                }
            };
            download();
        }
    }, [step, logResult, installPath]);

    // ... (Render logic) ...


    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="yellow">POE2 KG Client Patch Butler</Text>
            <Box marginBottom={1} />

            {step === 'INIT' && <Text>초기화 중...</Text>}

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

            {step === 'ANALYZING' && <Text>로그 분석 중...</Text>}

            {step === 'CONFIRM_FORCE' && (
                <Box flexDirection="column">
                    <Text color="green">최근 로그에서 패치 오류가 발견되지 않았습니다.</Text>
                    <Text color="gray">런처가 실행되지 않고 종료되는 등의 증상에 권장 드립니다.</Text>
                    <Box marginBottom={1} />
                    <Text>핵심 파일들을 강제로 패치하려면 <Text bold color="red">F</Text>를 누르세요. (현재 버전: <Text color="yellow">{extractVersion(logResult ? logResult.webRoot : null) || 'Unknown'}</Text>)</Text>
                    <Text>종료하려면 <Text bold color="cyan">Enter</Text>를 누르세요.</Text>
                </Box>
            )}

            {step === 'READY_TO_DOWNLOAD' && logResult && (
                <Box flexDirection="column">
                    <Text color="green">분석 완료!</Text>
                    <Text>오류 발생 버전: <Text bold color="red">{extractVersion(logResult.webRoot) || 'Unknown'}</Text></Text>
                    <Text>감지된 누락 파일: <Text bold color="yellow">{logResult.filesToDownload.length}개</Text></Text>
                    <Box marginLeft={2} flexDirection="column" marginBottom={1}>
                        {logResult.filesToDownload.map((file, index) => (
                            <Text key={index}> - {file}</Text>
                        ))}
                    </Box>
                    <Text>다운로드 URL (Web Root): <Text color="blue">{logResult.webRoot}</Text></Text>
                    <Box marginBottom={1} />
                    <Text>다운로드를 시작하려면 <Text bold color="cyan">Enter</Text></Text>
                    <Text>버전(URL)을 수정하려면 <Text bold color="cyan">E</Text></Text>
                    <Text>종료하려면 <Text bold color="cyan">Q</Text></Text>
                </Box>
            )}

            {step === 'EDIT_WEBROOT' && (
                <Box flexDirection="column">
                    <Text>Web Root URL 수정:</Text>
                    <PathInput
                        initialPath={editWebRoot}
                        onSubmit={(newUrl) => {
                            setLogResult(prev => prev ? { ...prev, webRoot: newUrl, backupWebRoot: newUrl } : null);
                            setStep('READY_TO_DOWNLOAD');
                        }}
                    />
                </Box>
            )}

            {step === 'DOWNLOADING' && (
                <Box flexDirection="column">
                    <Text>파일 다운로드 및 설치 중...</Text>
                    {logResult?.filesToDownload.map(file => {
                        const state = fileStates[file] || { status: 'waiting', progress: 0 };
                        return (
                            <ProgressBar
                                key={file}
                                fileName={file}
                                percentage={state.progress}
                                status={state.status}
                            />
                        );
                    })}
                </Box>
            )}

            {step === 'DONE' && (
                <Box flexDirection="column">
                    {(!logResult || !logResult.hasError) ? (
                        <Text color="green">최근 로그에서 패치 오류가 발견되지 않았습니다.</Text>
                    ) : (
                        <Box flexDirection="column">
                            {downloadResult && downloadResult.success ? (
                                <Text color="green">모든 파일 다운로드가 완료되었습니다! 홈페이지에서 다시 실행해주세요.</Text>
                            ) : (
                                <Box flexDirection="column">
                                    <Text color="red">다운로드 실패!</Text>
                                    <Text>일부 파일을 다운로드하지 못했습니다. 아래 내역을 확인하세요.</Text>
                                    <Box marginTop={1} marginBottom={1} borderStyle="single" borderColor="red" padding={1}>
                                        {downloadResult?.failures.map((fail, idx) => (
                                            <Box key={idx} flexDirection="column">
                                                <Text bold color="red">{fail.fileName}</Text>
                                                <Text>{fail.error.message}</Text>
                                            </Box>
                                        ))}
                                    </Box>
                                    {downloadResult?.failures.some(f => f.error.message.includes('404')) && (
                                        <Text color="yellow">
                                            [안내] 404 오류가 지속되면 카카오 게임즈 서버에서 요청을 일시 차단했을 수 있습니다.
                                            잠시 후 다시 시도하거나, 로그에 기록된 URL이 유효한지 확인해주세요.
                                            홈페이지에서 런처를 실행 후 도구를 다시 실행 할 경우 정상적으로 작동 할 수 있습니다.
                                        </Text>
                                    )}
                                    <Text color="gray">안전을 위해 실패 시 어떤 파일도 덮어쓰지 않았습니다.</Text>
                                </Box>
                            )}
                        </Box>
                    )}
                    <Box marginTop={1} flexDirection="column">
                        {cleanupStatus === 'pending' && (
                            <Text color="cyan">임시 폴더(.patch_temp)와 다운로드된 파일을 삭제하시겠습니까? (Enter: 삭제 / Q: 보존)</Text>
                        )}
                        {cleanupStatus === 'cleaning' && <Text color="yellow">청소 중...</Text>}
                        {cleanupStatus === 'done' && (
                            <Box flexDirection="column">
                                <Text color="green">임시 폴더가 삭제되었습니다.</Text>
                                <Text>종료하려면 아무 키나 누르세요.</Text>
                            </Box>
                        )}
                        {cleanupStatus === 'kept' && (
                            <Box flexDirection="column">
                                <Text color="gray">임시 폴더가 보존되었습니다. ({path.join(installPath, '.patch_temp')})</Text>
                                <Text>종료하려면 아무 키나 누르세요.</Text>
                            </Box>
                        )}
                    </Box>
                </Box>
            )}

            {step === 'ERROR' && (
                <Box flexDirection="column">
                    <Text color="red">오류 발생: {error}</Text>
                    <Text>종료하려면 아무 키나 누르세요.</Text>
                </Box>
            )}
        </Box>
    );
};

export default App;
