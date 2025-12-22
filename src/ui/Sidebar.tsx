import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

export interface SidebarContext {
    setVisible: (visible: boolean) => void;
    setStatus: (element: React.ReactNode) => void;
    setDescription: (desc: string) => void;
}

export interface SidebarItemConfig {
    keyChar: string;
    description: string;
    initialStatus?: React.ReactNode;
    initialVisible?: boolean;
    onInit?: (ctx: SidebarContext) => void;
    onClick?: (ctx: SidebarContext) => void;
}

interface SidebarProps {
    items: SidebarItemConfig[];
    isActive: boolean; // Only handle input when active
}

interface ItemState {
    description: string;
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
                item.onInit(ctx);
            }
        });
    }, []); // Run once on mount. Warning: Closures in onInit will be stale if they depend on changing App state without refs.

    useInput((input, key) => {
        if (!isActive) return;

        items.forEach((item, index) => {
            const state = itemStates[index];
            if (state && state.visible && item.onClick) {
                if (input.toLowerCase() === item.keyChar.toLowerCase()) {
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
                        return (
                            <Box key={index} flexDirection="row">
                                <Box width={5}>
                                    <Text>[<Text color="yellow">{config.keyChar}</Text>]</Text>
                                </Box>
                                <Text>
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
