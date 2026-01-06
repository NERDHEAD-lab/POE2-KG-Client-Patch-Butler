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
    /**
     * Called when the Sidebar item initializes.
     * 
     * [!WARNING]
     * The Sidebar component is frequently REMOUNTED when App state changes (to reset UI).
     * This `onInit` will re-run every time.
     * DO NOT put expensive or non-idempotent one-time logic (like App update checks) here.
     * Lift such state up to `App.tsx` instead.
     */
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

const getStringWidth = (str: string) => {
    let width = 0;
    for (let i = 0; i < str.length; i++) {
        const charCode = str.codePointAt(i);
        if (charCode === undefined) continue;
        
        // Basic range check for CJK (Korean, Chinese, Japanese)
        // This is a heuristic: most CJK chars are wide (2 columns)
        if (
            (charCode >= 0x1100 && charCode <= 0x11FF) || // Hangul Jamo
            (charCode >= 0x3130 && charCode <= 0x318F) || // Hangul Compatibility Jamo
            (charCode >= 0xAC00 && charCode <= 0xD7A3) || // Hangul Syllables
            (charCode >= 0x4E00 && charCode <= 0x9FFF)    // CJK Unified Ideographs
        ) {
            width += 2;
        } else {
            width += 1;
        }
    }
    return width;
};

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

    // Dynamic Width Calculation
    // Calculates the maximum width required by the visible items
    // Base width: 28 (minimum)
    // Item width formula:
    //   Key Part: 6 chars (" [X] " or " L [X] ")
    //   Description: getStringWidth(desc)
    //   Status: getStringWidth(status text) -> approximate, using 10 as buffer if status is ReactNode
    //   Gap: 1 char
    const maxContentWidth = React.useMemo(() => {
        const baseMin = 28;
        let max = baseMin;

        itemStates.forEach((state, index) => {
            const config = items[index];
            if (!state.visible || config.type === 'separator') return;

            let itemW = 6; // Key part "[A] "
            itemW += getStringWidth(state.description || '');

            // Estimate status width. Since status is ReactNode, we can't easily know its text width.
            // We'll assume a safe buffer or try to check if it's string.
            // For now, let's assume status takes ~4-8 chars if present.
            // A better way is to pass width hints, but heuristic is okay for TUI.
            if (state.status) {
                itemW += 10; // Buffer for status " ON", " OFF", " (v1.2)"
            }

            if (itemW > max) {
                max = itemW;
            }
        });

        return max + 2; // Add some padding
    }, [itemStates, items]);


    return (
        <Box flexDirection="column" marginLeft={1}>
            <Box borderStyle="single" paddingX={1} minWidth={maxContentWidth} flexDirection="column" flexGrow={1}>
                <Box flexDirection="column">
                    {itemStates.map((state, index) => {
                        const config = items[index];
                        if (!state.visible) return null;

                        if (config.type === 'separator') {
                            const desc = state.description;
                            let separatorText = '';

                            if (desc) {
                                // " Description ----------------- " style
                                const targetW = maxContentWidth - 4; // approximate content area
                                
                                // Basic padding: "desc " + dashes
                                let baseText = `${desc} `;
                                const currentW = getStringWidth(baseText);
                                const remainingW = Math.max(0, targetW - currentW);
                                
                                separatorText = baseText + '-'.repeat(remainingW);
                            } else {
                                // Simple line
                                separatorText = '-'.repeat(maxContentWidth - 4);
                            }

                            return (
                                <Box key={index} flexDirection="row" marginY={0}>
                                    <Text color="gray">{separatorText}</Text>
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
