import React from 'react';
import { Box, Text, useInput } from 'ink';

interface CaseCrashingProps {
    onGoBack: () => void;
}

const CaseCrashing: React.FC<CaseCrashingProps> = ({ onGoBack }) => {
    useInput((input, key) => {
        if (key.return || input === 'q' || input === 'Q') {
            onGoBack();
        }
    });

    return (
        <Box flexDirection="column">
            <Text bold color="red">대부분의 경우 POE2 자체의 문제로 증상이 완화 되지 않을 수 있습니다!</Text>
            <Box marginBottom={1} />
            <Text>아래 사항들을 검토할 수 있습니다.</Text>
            <Text> - 그래픽 드라이버 버전 최신화</Text>
            <Text> - Windows 업데이트</Text>
            <Text> - Windows 무결성 검사</Text>
            <Box marginLeft={2} flexDirection="column">
                <Text>1. 시작(win 키)에서 powersehll을 검색 후 관리자 권한으로 실행</Text>
                <Text>2. <Text color="yellow">sfc /scannow</Text> 실행</Text>
                <Text>3. <Text color="yellow">dism /online /cleanup-image /restorehealth</Text> 실행</Text>
            </Box>
            <Box marginBottom={1} />
            <Text>(초기 메뉴로 돌아가려면 <Text bold color="cyan">아무 키</Text>나 누르세요)</Text>
        </Box>
    );
};

export default CaseCrashing;
