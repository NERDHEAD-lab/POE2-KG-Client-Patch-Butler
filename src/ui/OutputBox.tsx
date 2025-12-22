import React from 'react';
import { Box, Text } from 'ink';

interface OutputBoxProps {
    message: string | null;
}

const OutputBox: React.FC<OutputBoxProps> = ({ message }) => {
    return (
        <Box flexDirection="column" marginTop={1}>
            <Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column" width="100%">
                <Text>{message || " "}</Text>
            </Box>
            <Box position="absolute" marginTop={0} marginLeft={2}>
                <Text> Output </Text>
            </Box>
        </Box>
    );
};

export default OutputBox;
