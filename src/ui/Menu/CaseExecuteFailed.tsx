import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { parseLog, LogParseResult, WHITELIST } from '../../utils/logParser.js';
import { downloadFiles } from '../../utils/downloader.js';
import { getShaderCachePaths, clearShaderCache } from '../../utils/cleaner.js';
import { runPackCheck } from '../../utils/launcher.js';
import path from 'path';
import fs from 'fs';
import { ProgressBar } from '../ProgressBar.js';

interface CaseExecuteFailedProps {
    installPath: string;
    onGoBack: () => void;
    onExit: () => void;
}

type Step = 'INIT' | 'STEP1_CONFIRM' | 'STEP1_DOWNLOADING' | 'STEP1_DONE' | 'STEP2_CONFIRM' | 'STEP2_DONE' | 'STEP3_CONFIRM' | 'STEP3_RUNNING' | 'STEP4_CONFIRM' | 'ERROR';

const extractVersion = (url: string | null): string | null => {
    if (!url) return null;
    const match = url.match(/\/patch\/([^\/]+)\/?/);
    return match ? match[1] : null;
};

const CaseExecuteFailed: React.FC<CaseExecuteFailedProps> = ({ installPath, onGoBack, onExit }) => {
    const [step, setStep] = useState<Step>('INIT');
    const [subMsg, setSubMsg] = useState('');
    const [logResult, setLogResult] = useState<LogParseResult | null>(null);
    const [cachePaths, setCachePaths] = useState<string[]>([]);
    const [fileStates, setFileStates] = useState<Record<string, any>>({});
    const [packCheckExists, setPackCheckExists] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                // Step 1 prep
                const result = await parseLog(installPath);
                setLogResult(result);
                setStep('STEP1_CONFIRM');
            } catch (e) {
                setSubMsg(`로그 분석 실패: ${e instanceof Error ? e.message : String(e)}`);
                setStep('ERROR');
            }
        };
        init();
    }, [installPath]);

    // Handlers for steps
    const startForcePatch = async () => {
        if (!logResult || !logResult.webRoot) return;
        setStep('STEP1_DOWNLOADING');

        try {
            await downloadFiles(
                logResult.webRoot,
                logResult.backupWebRoot || logResult.webRoot,
                WHITELIST,
                installPath,
                (status) => {
                    setFileStates(prev => ({
                        ...prev,
                        [status.fileName]: {
                            status: status.status,
                            progress: status.progress
                        }
                    }));
                }
            );
            setStep('STEP1_DONE');
        } catch (e) {
            setSubMsg(`패치 실패: ${e instanceof Error ? e.message : String(e)}`);
            setStep('ERROR');
        }
    };

    const initStep2 = () => {
        const paths = getShaderCachePaths();
        setCachePaths(paths);
        setStep('STEP2_CONFIRM');
    };

    const doClearCache = async () => {
        try {
            await clearShaderCache(cachePaths);
            setStep('STEP2_DONE');
        } catch (e) {
            setSubMsg(`캐시 삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
            setStep('STEP2_DONE');
        }
    };

    const initStep3 = () => {
        const exists = fs.existsSync(path.join(installPath, 'PackCheck.exe'));
        setPackCheckExists(exists);
        setStep('STEP3_CONFIRM');
    };

    const doRunPackCheck = async () => {
        if (!packCheckExists) {
            if (logResult?.webRoot) {
                setSubMsg("PackCheck.exe 다운로드 중...");
                try {
                    await downloadFiles(
                        logResult.webRoot,
                        logResult.backupWebRoot || logResult.webRoot,
                        ['PackCheck.exe'],
                        installPath,
                        () => { }
                    );
                    setPackCheckExists(true);
                } catch (e) {
                    setSubMsg("PackCheck.exe 다운로드 실패");
                }
            }
        }

        setStep('STEP3_RUNNING');
        try {
            await runPackCheck(installPath);
        } catch (e) {
            // Ignore error from spawn/close, user sees output
        }
        setStep('STEP4_CONFIRM');
    };

    const openManualGuide = () => {
        const url = 'https://nerdhead-lab.github.io/POE2-KG-Client-Patch-Butler?page=solution.md';
        const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
        import('child_process').then(cp => {
            cp.spawn('cmd', ['/c', 'start', url], { windowsVerbatimArguments: true });
        });
    };

    useInput((input, key) => {
        if (step === 'STEP1_CONFIRM') {
            if (key.return) startForcePatch();
            else if (input === 's' || input === 'S') initStep2();
            else if (input === 'q' || input === 'Q') onGoBack();
        }
        else if (step === 'STEP1_DONE') {
            if (key.return || input === 's' || input === 'S') initStep2();
            else if (input === 'q' || input === 'Q') onGoBack();
        }
        else if (step === 'STEP2_CONFIRM') {
            if (key.return) {
                if (cachePaths.length > 0) doClearCache();
                else setStep('STEP2_DONE');
            }
            else if (input === 's' || input === 'S') initStep3();
            else if (input === 'q' || input === 'Q') onGoBack();
        }
        else if (step === 'STEP2_DONE') {
            if (key.return || input === 's' || input === 'S') initStep3();
            else if (input === 'q' || input === 'Q') onGoBack();
        }
        else if (step === 'STEP3_CONFIRM') {
            if (key.return) doRunPackCheck();
            else if (input === 's' || input === 'S') setStep('STEP4_CONFIRM');
            else if (input === 'q' || input === 'Q') onGoBack();
        }
        else if (step === 'STEP4_CONFIRM') {
            if (key.return) openManualGuide();
            else if (input === 'q' || input === 'Q') onGoBack();
        }
        else if (step === 'ERROR') {
            if (key.return || input === 'q' || input === 'Q') onGoBack();
        }
    });

    return (
        <Box flexDirection="column">
            {step === 'INIT' && <Text>준비 중...</Text>}

            {/* STEP 1 UI */}
            {step === 'STEP1_CONFIRM' && (
                <Box flexDirection="column">
                    <Text bold color="yellow">Step 1: 클라이언트 핵심 파일 강제 패치</Text>
                    <Box marginBottom={1} />
                    <Text>아래와 같은 핵심 파일들을 현재 확인된 버전 ({extractVersion(logResult?.webRoot || null) || 'Unknown'})에서 패치합니다.</Text>
                    <Box marginLeft={2} flexDirection="column">
                        {WHITELIST.map(f => <Text key={f}> - {f}</Text>)}
                    </Box>
                    <Box marginBottom={1} />
                    <Text>(시작 하려면 <Text bold color="cyan">Enter</Text>, 스킵하고 다음 솔루션을 보려면 <Text bold color="cyan">S</Text>, 초기메뉴는 <Text bold color="cyan">Q</Text>)</Text>
                </Box>
            )}

            {step === 'STEP1_DOWNLOADING' && (
                <Box flexDirection="column">
                    <Text>다운로드 중...</Text>
                    {WHITELIST.map(f => {
                        const s = fileStates[f];
                        return s ? <ProgressBar key={f} fileName={f} percentage={s.progress} status={s.status} /> : null;
                    })}
                </Box>
            )}

            {step === 'STEP1_DONE' && (
                <Box flexDirection="column">
                    <Text color="green">핵심파일 패치가 완료되었습니다. 홈페이지에서 POE2가 정상적으로 실행되는지 확인합니다.</Text>
                    <Box marginBottom={1} />
                    <Text>해당 작업은 랜더링 캐시를 제거합니다.</Text>
                    <Text>실행 및 맵 이동 시 최초 1회 로딩이 오래걸리게 될 수 있습니다.</Text>
                    <Text>(시작 하려면 <Text bold color="cyan">Enter</Text>, 스킵하고 다음 솔루션을 보려면 <Text bold color="cyan">S</Text>, 초기메뉴는 <Text bold color="cyan">Q</Text>)</Text>
                </Box>
            )}

            {/* STEP 2 UI */}
            {step === 'STEP2_CONFIRM' && (
                <Box flexDirection="column">
                    <Text bold color="yellow">Step 2: 그래픽 랜더링 캐시 초기화</Text>
                    <Box marginBottom={1} />
                    {cachePaths.length > 0 ? (
                        <Box flexDirection="column">
                            <Text>발견된 캐시 폴더:</Text>
                            {cachePaths.map(p => <Text key={p} color="red"> - {p}</Text>)}
                            <Box marginBottom={1} />
                            <Text>(시작 하려면 <Text bold color="cyan">Enter</Text>, 스킵하고 다음 솔루션을 보려면 <Text bold color="cyan">S</Text>, 초기메뉴는 <Text bold color="cyan">Q</Text>)</Text>
                        </Box>
                    ) : (
                        <Box flexDirection="column">
                            <Text>제거할 캐시 폴더가 발견되지 않았습니다.</Text>
                            <Text>(다음 솔루션을 보려면 <Text bold color="cyan">Enter</Text> or <Text bold color="cyan">S</Text>, 초기메뉴는 <Text bold color="cyan">Q</Text>)</Text>
                        </Box>
                    )}
                </Box>
            )}

            {step === 'STEP2_DONE' && (
                <Box flexDirection="column">
                    <Text color="green">캐시 제거가 완료되었습니다. 홈페이지에서 POE2가 정상적으로 실행되는지 확인합니다.</Text>
                    <Text>실행 되지 않을 경우 설치된 경로에서 무결성 검사(PackCheck.exe)를 수행합니다.</Text>
                    <Text color="red">해당 작업은 오래걸릴 수 있습니다!</Text>
                    <Text>(시작 하려면 <Text bold color="cyan">Enter</Text>, 스킵하고 다음 솔루션을 보려면 <Text bold color="cyan">S</Text>, 초기메뉴는 <Text bold color="cyan">Q</Text>)</Text>
                </Box>
            )}

            {/* STEP 3 UI */}
            {step === 'STEP3_CONFIRM' && (
                <Box flexDirection="column">
                    <Text bold color="yellow">Step 3: POE2 카카오게임즈의 자체 무결성 검사 수행</Text>
                    <Box marginBottom={1} />
                    {!packCheckExists && (
                        <Box flexDirection="column">
                            <Text color="red">PackCheck.exe가 없음을 확인했습니다!! 설치가 비정상적으로 종료된 것으로 추정됩니다.</Text>
                            <Text>서버로부터 PackCheck.exe을 강제로 내려 받아 무결성 검사를 진행 할 수 있습니다.</Text>
                        </Box>
                    )}
                    <Text>(시작 하려면 <Text bold color="cyan">Enter</Text>, 스킵하고 다음 솔루션을 보려면 <Text bold color="cyan">S</Text>, 초기메뉴는 <Text bold color="cyan">Q</Text>)</Text>
                </Box>
            )}

            {step === 'STEP3_RUNNING' && <Text>PackCheck 실행 중... (새 창 확인)</Text>}

            {step === 'STEP4_CONFIRM' && (
                <Box flexDirection="column">
                    <Text bold color="yellow">Step 4: 수동 진단</Text>
                    <Box marginBottom={1} />
                    <Text color="green">무결성 검사가 완료되었습니다. 홈페이지에서 POE2가 정상적으로 실행되는지 확인합니다.</Text>
                    <Text>정상적으로 실행되지 않는다면 아래 문서를 참고해 수동 진단이 필요합니다.</Text>

                    <Box marginBottom={1} />
                    <Text>수동 진단 Link:</Text>
                    <Text color="blue" underline>https://nerdhead-lab.github.io/POE2-KG-Client-Patch-Butler?page=solution.md</Text>

                    <Box marginBottom={1} />
                    <Text>(가이드를 보려면 <Text bold color="cyan">Enter</Text>, 초기메뉴는 <Text bold color="cyan">Q</Text>)</Text>
                </Box>
            )}

            {step === 'ERROR' && <Text color="red">Error: {subMsg}</Text>}
        </Box>
    );
};

export default CaseExecuteFailed;
