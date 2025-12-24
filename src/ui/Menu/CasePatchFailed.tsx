import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { parseLog, LogParseResult, generateForcePatchResult } from '../../utils/logParser.js';
import { downloadFiles, cleanupTempDir } from '../../utils/downloader.js';
import { getAppDataDirectory, getSilentModeEnabled } from '../../utils/config.js';
import path from 'path';
import { ProgressBar } from '../ProgressBar.js';
import { PathInput } from '../PathInput.js';

interface CasePatchFailedProps {
    installPath: string;
    onGoBack: () => void;
    onExit: () => void;
    isAutoFix?: boolean;
}

type Step = 'ANALYZING' | 'CONFIRM_FORCE' | 'READY_TO_DOWNLOAD' | 'EDIT_WEBROOT' | 'DOWNLOADING' | 'DONE' | 'ERROR';

const extractVersion = (url: string | null): string | null => {
    if (!url) return null;
    const match = url.match(/\/patch\/([^\/]+)\/?/);
    return match ? match[1] : null;
};

const CasePatchFailed: React.FC<CasePatchFailedProps> = ({ installPath, onGoBack, onExit, isAutoFix = false }) => {
    const [isSilent] = useState(getSilentModeEnabled());
    const [step, setStep] = useState<Step>('ANALYZING');
    const [error, setError] = useState<string>('');
    const [logResult, setLogResult] = useState<LogParseResult | null>(null);
    const [fileStates, setFileStates] = useState<Record<string, { status: 'waiting' | 'downloading' | 'done' | 'error', progress: number, error?: Error }>>({});
    const [downloadResult, setDownloadResult] = useState<{ success: boolean; failures: { fileName: string; error: Error }[] } | null>(null);
    const [cleanupStatus, setCleanupStatus] = useState<'pending' | 'cleaning' | 'done' | 'kept'>('pending');
    const [editWebRoot, setEditWebRoot] = useState<string>('');
    const [countdown, setCountdown] = useState<number | null>(null);

    useEffect(() => {
        if (step === 'ANALYZING') {
            const analyze = async () => {
                await new Promise(r => setTimeout(r, 500));
                try {
                    const result = await parseLog(installPath);
                    setLogResult(result);

                    if (!result.hasError || result.filesToDownload.length === 0) {
                        setStep('CONFIRM_FORCE');
                    } else {
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
                    if (!logResult.webRoot) throw new Error('로그 파일에서 Web Root 정보를 찾을 수 없습니다.');

                    const result = await downloadFiles(
                        logResult.webRoot,
                        logResult.backupWebRoot || logResult.webRoot,
                        logResult.filesToDownload,
                        extractVersion(logResult.webRoot) || 'Unknown',
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

    // Silent Mode Automation
    useEffect(() => {
        if (!isSilent || !isAutoFix) return;

        if (step === 'CONFIRM_FORCE' && logResult) {
            // Auto Force
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
        } else if (step === 'READY_TO_DOWNLOAD') {
            // Auto Download
            setTimeout(() => setStep('DOWNLOADING'), 500);
        } else if (step === 'DONE' && cleanupStatus === 'pending') {
            // Auto Cleanup
            setCleanupStatus('cleaning');
            cleanupTempDir(installPath).then(() => setCleanupStatus('done'));
        }
    }, [isSilent, step, logResult, cleanupStatus, installPath]);

    // Auto Exit Countdown
    useEffect(() => {
        if (step === 'DONE' && cleanupStatus === 'done' && isSilent && isAutoFix) {
            if (countdown === null) {
                setCountdown(5);
            } else if (countdown > 0) {
                const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
                return () => clearTimeout(timer);
            } else {
                onExit();
            }
        }
    }, [step, cleanupStatus, isSilent, isAutoFix, countdown, onExit]);

    useInput((input, key) => {
        if (step === 'CONFIRM_FORCE') {
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
            } else if (input === 's' || input === 'S') {
                // 스킵 로직 (필요시 구현)
            } else if (input === 'q' || input === 'Q') {
                onGoBack();
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
                onGoBack();
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
                if (input || key.return || key.escape || key.backspace || key.delete) {
                    if (isAutoFix) {
                        onExit();
                    } else {
                        onGoBack();
                    }
                }
            }
        } else if (step === 'ERROR') {
            if (input || key.return || key.escape) {
                onGoBack();
            }
        }
    });

    return (
        <Box flexDirection="column">
            {step === 'ANALYZING' && <Text>로그 분석 중...</Text>}

            {step === 'CONFIRM_FORCE' && logResult && (
                <Box flexDirection="column">
                    <Text color="green">최근 로그에서 패치 오류가 발견되지 않았습니다.</Text>
                    <Box marginBottom={1} />
                    <Text>핵심 파일들을 강제로 패치하려면 <Text bold color="red">F</Text>를 누르세요. (현재 버전: <Text color="yellow">{extractVersion(logResult.webRoot) || 'Unknown'}</Text>)</Text>
                    <Text>초기 메뉴로 돌아가려면 <Text bold color="cyan">Q</Text>를 누르세요.</Text>
                </Box>
            )}

            {step === 'CONFIRM_FORCE' && isSilent && isAutoFix && logResult && (
                <Text color="yellow">자동 복구 모드: 패치 오류 수정 진행 중...</Text>
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
                    <Text>초기 메뉴로 돌아가려면 <Text bold color="cyan">Q</Text></Text>
                </Box>
            )}

            {step === 'READY_TO_DOWNLOAD' && isSilent && isAutoFix && logResult && (
                <Box flexDirection="column">
                    <Text color="green">분석 완료. 자동 다운로드 준비 중...</Text>
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
                                    <Text>일부 파일을 다운로드하지 못했습니다.</Text>
                                    <Box marginTop={1} marginBottom={1} borderStyle="single" borderColor="red" padding={1}>
                                        {downloadResult?.failures.map((fail, idx) => (
                                            <Box key={idx} flexDirection="column">
                                                <Text bold color="red">{fail.fileName}</Text>
                                                <Text>{fail.error.message}</Text>
                                            </Box>
                                        ))}
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    )}
                    <Box marginTop={1} flexDirection="column">
                        {cleanupStatus === 'pending' && (
                            <Text color="cyan">임시 폴더(.patch_temp)와 다운로드된 파일을 삭제하시겠습니까? (<Text bold color="yellow">Enter</Text>: 삭제 / <Text bold color="yellow">Q</Text>: 보존)</Text>
                        )}
                        {cleanupStatus === 'cleaning' && <Text color="yellow">청소 중...</Text>}
                        {cleanupStatus === 'done' && (
                            <Box flexDirection="column">
                                <Text color="green">임시 폴더가 삭제되었습니다.</Text>
                                {isAutoFix ? (
                                    isSilent ? (
                                        <Text color="yellow">모든 작업이 완료되었습니다. {countdown}초 후 종료합니다.</Text>
                                    ) : (
                                        <Text>종료하려면 <Text bold color="cyan">아무 키</Text>나 누르세요.</Text>
                                    )
                                ) : (
                                    <Text>초기 메뉴로 돌아가려면 <Text bold color="cyan">아무 키</Text>나 누르세요.</Text>
                                )}
                            </Box>
                        )}
                        {cleanupStatus === 'kept' && (
                            <Box flexDirection="column">
                                <Text color="gray">임시 폴더가 보존되었습니다. ({path.join(installPath, '.patch_temp')})</Text>
                                <Text>초기 메뉴로 돌아가려면 <Text bold color="cyan">아무 키</Text>나 누르세요.</Text>
                            </Box>
                        )}
                    </Box>
                </Box>
            )}

            {step === 'ERROR' && (
                <Box flexDirection="column">
                    <Text color="red">오류 발생: {error}</Text>
                    <Text>초기 메뉴로 돌아가려면 <Text bold color="cyan">아무 키</Text>나 누르세요.</Text>
                </Box>
            )}
        </Box>
    );
};

export default CasePatchFailed;
