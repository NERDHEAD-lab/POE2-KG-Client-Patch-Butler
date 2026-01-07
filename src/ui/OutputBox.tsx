import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { logger } from '../utils/logger.js';

interface LogMessage {
    text: string;
    type: 'info' | 'warn' | 'error' | 'success';
}

const OutputBox: React.FC = () => {
    const [message, setMessage] = useState<LogMessage | null>(null);

    useEffect(() => {
        const handleLog = (event: { message: string, type: 'info' | 'warn' | 'error' | 'success' }) => {
            setMessage({ text: event.message, type: event.type });
        };

        logger.on('log', handleLog);
        return () => {
            logger.off('log', handleLog);
        };
    }, []);

    let color = 'white';
    if (message?.type === 'info') color = 'white';
    if (message?.type === 'warn') color = 'yellow';
    if (message?.type === 'error') color = 'red';
    if (message?.type === 'success') color = 'green';

    return (
        <Box flexDirection="column" marginTop={1}>
            <Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column" width="100%">
                <Text color={color}>{message ? message.text : " "}</Text>
            </Box>
            <Box position="absolute" marginTop={0} marginLeft={2}>
                <Text> Output </Text>
            </Box>
        </Box>
    );
};

export default OutputBox;
