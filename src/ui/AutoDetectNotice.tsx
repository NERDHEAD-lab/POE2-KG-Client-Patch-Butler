import React from 'react';
import { Text, Box } from 'ink';

interface AutoDetectNoticeProps {
    isEnabled: boolean;
    showMsg: boolean;
    baseColor?: string;
}

const AutoDetectNotice: React.FC<AutoDetectNoticeProps> = ({ isEnabled, showMsg, baseColor = 'gray' }) => {
    return (
        <Box flexDirection="column">
            <Text color={baseColor}>
                오류 자동 감지를 {isEnabled ? <Text color="red">끄려면</Text> : <Text color="green">켜려면</Text>} <Text bold color={isEnabled ? 'red' : 'green'}>A</Text>를 눌러주세요
            </Text>
            {showMsg && (
                isEnabled ? (
                    <Text color="green">해당 기능은 업데이트 실패 때만 자동으로 감지하여 해결합니다.</Text>
                ) : (
                    <Text color="red">자동 감지 기능을 off 합니다.</Text>
                )
            )}
        </Box>
    );
};

export default AutoDetectNotice;
