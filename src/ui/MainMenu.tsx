import React from 'react';
import { Box, Text, useInput } from 'ink';

interface MainMenuProps {
    onSelect: (option: number) => void;
    onExit: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onSelect, onExit }) => {

    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const options = [
        { id: 1, label: "1. 런처가 실행 되며 패치를 다운받으려 시도 하지만 실패 합니다." },
        { id: 2, label: "2. 홈페이지를 통해 실행했지만 런처가 실행 되자마자 꺼지거나, 실행되지 않습니다." },
        { id: 3, label: "3. 게임 플레이 중에 간헐적으로 종료됩니다." },
        { id: 0, label: "0. 일치하는 증상이 없습니다. (증상 보고)" }
    ];

    useInput((input, key) => {
        if (input === 'q' || input === 'Q') {
            onExit();
            process.exit(0);
            return;
        }

        if (input === '1') onSelect(1);
        if (input === '2') onSelect(2);
        if (input === '3') onSelect(3);
        if (input === '0') onSelect(0);

        if (key.upArrow) {
            setSelectedIndex(prev => (prev - 1 + options.length) % options.length);
        }
        if (key.downArrow) {
            setSelectedIndex(prev => (prev + 1) % options.length);
        }
        if (key.return) {
            onSelect(options[selectedIndex].id);
        }
    });

    return (
        <Box flexDirection="column">
            <Text>현재 증상을 선택하세요. (<Text bold color="cyan">위, 아래 방향키</Text>로 이동 및 <Text bold color="cyan">Enter</Text> 혹은 <Text bold color="cyan">숫자</Text>로 선택, 종료하려면 <Text bold color="cyan">Q</Text>를 누르세요)</Text>
            <Box marginBottom={1} />

            {options.map((opt, idx) => (
                <Text key={opt.id} color={idx === selectedIndex ? "green" : undefined}>
                    {idx === selectedIndex ? "> " : "  "}
                    {opt.label}
                </Text>
            ))}
        </Box>
    );
};

export default MainMenu;
