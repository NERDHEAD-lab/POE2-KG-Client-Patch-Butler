import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface PathInputProps {
    initialPath?: string;
    onSubmit: (path: string) => void;
}

export const PathInput: React.FC<PathInputProps> = ({ initialPath = '', onSubmit }) => {
    const [path, setPath] = useState(initialPath);

    return (
        <Box flexDirection="column">
            <Text>POE2 설치 경로를 입력해주세요 (Enter to confirm):</Text>
            <Box borderStyle="round" borderColor="cyan">
                <TextInput
                    value={path}
                    onChange={setPath}
                    onSubmit={onSubmit}
                />
            </Box>
        </Box>
    );
};
