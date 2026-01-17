import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { spawn } from 'child_process';

interface CaseReportIssueProps {
    onGoBack: () => void;
}

const CaseReportIssue: React.FC<CaseReportIssueProps> = ({ onGoBack }) => {
    const [status, setStatus] = useState<'IDLE' | 'OPENING'>('IDLE');
    const url = 'https://github.com/NERDHEAD-lab/POE2-KG-Client-Patch-Butler/issues';

    useInput((input, key) => {
        if (key.return) {
            setStatus('OPENING');
            const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
            spawn('cmd', ['/c', 'start', url], { windowsVerbatimArguments: true });
        }

        if (input.toLowerCase() === 'q' || key.escape) {
            onGoBack();
        }
    });

    return (
        <Box flexDirection="column">
            <Text>브라우저에서 GitHub Issues 페이지를 엽니다.</Text>
            <Text color="blue" underline>{url}</Text>
            <Box marginBottom={1} />

            {status === 'IDLE' ? (
                <Box flexDirection="column">
                    <Text>이 페이지를 열려면 <Text bold color="cyan">Enter</Text>를 누르세요.</Text>
                    <Text>초기 메뉴로 돌아가려면 <Text bold color="cyan">Q</Text>를 누르세요.</Text>
                </Box>
            ) : (
                <Box flexDirection="column">
                    <Text color="green">브라우저를 열었습니다!</Text>
                    <Text>초기 메뉴로 돌아가려면 <Text bold color="cyan">Q</Text>를 누르세요.</Text>
                </Box>
            )}
        </Box>
    );
};

export default CaseReportIssue;
