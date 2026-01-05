import React from 'react';
import { Box, Text, useInput } from 'ink';

interface CaseGameRunningProps {
    onIgnore: () => void;
    onExit: () => void;
}

const CaseGameRunning: React.FC<CaseGameRunningProps> = ({ onIgnore, onExit }) => {

    useInput((input, key) => {
        if (input === 'f' || input === 'F') {
            onIgnore();
        }
        if (input === 'q' || input === 'Q') {
            onExit();
        }
    });

    return (
        <Box flexDirection="column" borderColor="red" borderStyle="single" padding={1}>
            <Text color="red" bold>⚠️ 경고: 게임 클라이언트(PathOfExile_KG.exe) 실행이 감지되었습니다.</Text>
            <Box marginBottom={1} />
            <Text>게임 실행 중에는 툴 조작을 권장하지 않습니다.</Text>
            <Text>예상치 못한 오류가 발생할 수 있으니 툴을 종료하거나 작업을 중단해주세요.</Text>
            <Box marginTop={1} flexDirection="column">
                <Text>무시하고 계속 진행하려면 <Text bold color="yellow">F (권장하지 않음)</Text></Text>
                <Text>프로그램을 종료하려면 <Text bold color="red">Q</Text></Text>
            </Box>
        </Box>
    );
};

export default CaseGameRunning;
