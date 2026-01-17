import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
// @ts-ignore
import SelectInput from 'ink-select-input';
import { BrowserProfile, detectBrowsers, getSupportedBrowserNames } from '../utils/browser.js';
import { logger } from '../utils/logger.js';

interface Props {
    onSelect: (profile: BrowserProfile | null) => void;
    onCancel: () => void;
}

// Define base interface compatible with ink-select-input's Item
interface Item {
    label: string;
    value: string;
    key?: string;
}

interface BrowserItem extends Item {
    profile: BrowserProfile | null;
}

const BrowserSelector: React.FC<Props> = ({ onSelect, onCancel }) => {
    const [items, setItems] = useState<BrowserItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBrowsers = async () => {
             try {
                // Initial Default Option
                const detected = detectBrowsers();
                
                const menuItems: BrowserItem[] = [
                    {
                        label: '시스템 기본값 (마지막 사용)',
                        value: 'system_default',
                        profile: null 
                    }
                ];

                detected.forEach((p, index) => {
                    menuItems.push({
                        label: `${p.browserName} - ${p.displayName} (${p.profileName})`,
                        value: `${p.browserName}_${p.profileName}_${index}`,
                        profile: p
                    });
                });

                setItems(menuItems);
             } catch (e) {
                logger.error(`브라우저 검색 중 오류 발생: ${(e as Error).message}`);
             } finally {
                setLoading(false);
             }
        };

        fetchBrowsers();
    }, []);

    useInput((input, _key) => {
        if (input.toLowerCase() === 'q') {
            onCancel();
        }
    });

    const handleSelect = (item: Item) => {
        // Safe cast as we know we populated it with BrowserItems
        onSelect((item as BrowserItem).profile);
    };

    if (loading) {
        return <Text>브라우저 목록을 불러오는 중...</Text>;
    }

    const supportedBrowsers = getSupportedBrowserNames().join(', ');

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
            <Text bold color="yellow">브라우저 프로필 선택</Text>
            <Text color="gray">지원하는 브라우저: {supportedBrowsers}</Text>
            <Text color="gray">이외 브라우저 추가를 원하시면 문의해주세요.</Text>
            <Text color="gray"><Text color="cyan">Q</Text>를 누르면 취소합니다. 선택 시 설정이 저장됩니다.</Text>
            <Box marginTop={1}>
                {items.length > 0 ? (
                    <SelectInput items={items} onSelect={handleSelect} />
                ) : (
                    <Text color="red">설치된 브라우저를 찾을 수 없습니다.</Text>
                )}
            </Box>
        </Box>
    );
};

export default BrowserSelector;
