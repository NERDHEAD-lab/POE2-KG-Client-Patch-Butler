import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

export interface SidebarContext {
    setVisible: (visible: boolean) => void;
    setStatus: (element: React.ReactNode) => void;
    setDescription: (desc: string) => void;
}

export interface SidebarItemConfig {
    keyChar?: string; // Optional for separators or plain text
    description?: string;
    type?: 'item' | 'separator';
    initialStatus?: React.ReactNode;
    initialVisible?: boolean;
    isChild?: boolean;
    disabled?: boolean;
    onInit?: (ctx: SidebarContext) => void | (() => void);
    onClick?: (ctx: SidebarContext) => void;
}

interface SidebarProps {
    items: SidebarItemConfig[];
    isActive: boolean; // Only handle input when active
}

interface ItemState {
    description?: string;
    status: React.ReactNode;
    visible: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ items, isActive }) => {
    // We strictly assume 'items' config array is static or at least stable in length/order for this simple implementation.
    // If items change dynamically, this detailed state management would need keys.
    const [itemStates, setItemStates] = useState<ItemState[]>(() =>
        items.map(i => ({
            description: i.description,
            status: i.initialStatus || null,
            visible: i.initialVisible ?? true
        }))
    );

    // Initializer
    useEffect(() => {
        const cleanups: (() => void)[] = [];
        items.forEach((item, index) => {
            if (item.onInit) {
                const ctx: SidebarContext = {
                    setVisible: (v) => setItemStates(prev => {
                        const next = [...prev];
                        next[index] = { ...next[index], visible: v };
                        return next;
                    }),
                    setStatus: (s) => setItemStates(prev => {
                        const next = [...prev];
                        next[index] = { ...next[index], status: s };
                        return next;
                    }),
                    setDescription: (d) => setItemStates(prev => {
                        const next = [...prev];
                        next[index] = { ...next[index], description: d };
                        return next;
                    })
                };
                const cleanup = item.onInit(ctx);
                if (typeof cleanup === 'function') cleanups.push(cleanup);
            }
        });
        return () => {
            cleanups.forEach(c => c());
        };
    }, []); // Run once on mount. Warning: Closures in onInit will be stale if they depend on changing App state without refs.

    useInput((input, key) => {
        if (!isActive) return;

        items.forEach((item, index) => {
            const state = itemStates[index];
            if (state && state.visible && item.onClick && item.keyChar && !item.disabled) {
                let triggered = false;

                // Handle F-keys (F1-F12) using key object from Ink
                if (item.keyChar.toUpperCase().startsWith('F')) {
                    const fNum = parseInt(item.keyChar.substring(1), 10);
                    // @ts-ignore: ink key types might be missing dynamic access
                    if (!isNaN(fNum) && key[`f${fNum}` as keyof typeof key]) {
                        triggered = true;
                    }
                } else {
                    // Normal character input
                    if (input.toLowerCase() === item.keyChar.toLowerCase()) {
                        triggered = true;
                    }
                }

                if (triggered) {
                    const ctx: SidebarContext = {
                        setVisible: (v) => setItemStates(prev => {
                            const next = [...prev];
                            next[index] = { ...next[index], visible: v };
                            return next;
                        }),
                        setStatus: (s) => setItemStates(prev => {
                            const next = [...prev];
                            next[index] = { ...next[index], status: s };
                            return next;
                        }),
                        setDescription: (d) => setItemStates(prev => {
                            const next = [...prev];
                            next[index] = { ...next[index], description: d };
                            return next;
                        })
                    };
                    item.onClick(ctx);
                }
            }
        });
    });

    return (
        <Box flexDirection="column" marginLeft={1}>
            <Box borderStyle="single" paddingX={1} minWidth={28} flexDirection="column" flexGrow={1}>
                <Box flexDirection="column">
                    {itemStates.map((state, index) => {
                        const config = items[index];
                        if (!state.visible) return null;

                        if (config.type === 'separator') {
                            return (
                                <Box key={index} flexDirection="row" marginY={0}>
                                    <Text color="gray">------------------------</Text>
                                </Box>
                            );
                        }

                        const isGray = config.disabled;
                        const keyColor = isGray ? 'gray' : 'cyan';
                        const textColor = isGray ? 'gray' : undefined;

                        return (
                            <Box key={index} flexDirection="row">
                                <Box width={6} flexDirection="row">
                                    {config.isChild && <Text color="gray">{'ㄴ'}</Text>}
                                    {config.keyChar ? (
                                        <Text>[<Text color={keyColor}>{config.keyChar}</Text>]</Text>
                                    ) : (
                                        <Text> </Text>
                                    )}
                                </Box>
                                <Text color={textColor}>
                                    {state.description} {state.status}
                                </Text>
                            </Box>
                        );
                    })}
                </Box>
            </Box>
            <Box position="absolute" marginTop={0} marginLeft={2}>
                <Text> 빠른 도구 </Text>
            </Box>
        </Box>
    );
};

export default Sidebar;
