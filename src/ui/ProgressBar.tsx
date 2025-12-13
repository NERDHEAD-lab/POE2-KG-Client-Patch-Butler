import React from 'react';
import { Box, Text } from 'ink';

interface ProgressBarProps {
    fileName: string;
    percentage: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ fileName, percentage }) => {
    const width = 30;
    const completed = Math.round((width * percentage) / 100);
    const remaining = width - completed;
    const bar = '█'.repeat(completed) + '░'.repeat(remaining);

    return (
        <Box flexDirection="column" marginBottom={1}>
            <Text>{fileName} ({percentage}%)</Text>
            <Text color="green">{bar}</Text>
        </Box>
    );
};
