import React from 'react';
import { Box, Text } from 'ink';

interface ProgressBarProps {
    fileName: string;
    percentage: number;
    status?: 'waiting' | 'downloading' | 'done' | 'error';
    errorMsg?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ fileName, percentage, status = 'downloading', errorMsg }) => {
    const width = 30;
    const safePercentage = Math.min(Math.max(percentage, 0), 100);
    const completed = Math.round((width * safePercentage) / 100);
    const remaining = width - completed;

    let barColor = 'green';
    let text = `${percentage}%`;

    if (status === 'waiting') {
        barColor = 'grey';
        text = '대기 중...';
    } else if (status === 'error') {
        barColor = 'red';
        text = '오류';
    } else if (status === 'done') {
        text = '완료';
    }

    const bar = '█'.repeat(completed) + '░'.repeat(Math.max(0, remaining));

    return (
        <Box flexDirection="column" marginBottom={1}>
            <Box>
                <Text>{fileName} </Text>
                {status === 'error' ? (
                    <Text color="red">[{text}]</Text>
                ) : (
                    <Text>({text})</Text>
                )}
            </Box>
            <Text color={barColor}>{bar}</Text>
        </Box>
    );
};
