import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { TitleProps } from './types.js';

const COLORS = [
    '#FF0000', '#FF3300', '#FF6600', '#FF9900', '#FFCC00', // Red to Yellow
    '#FFFF00', '#CCFF00', '#99FF00', '#66FF00', '#33FF00', // Yellow to Green
    '#00FF00', '#00FF33', '#00FF66', '#00FF99', '#00FFCC', // Green to Cyan
    '#00FFFF', '#00CCFF', '#0099FF', '#0066FF', '#0033FF', // Cyan to Blue
    '#0000FF', '#3300FF', '#6600FF', '#9900FF', '#CC00FF', // Blue to Magenta
    '#FF00FF', '#FF00CC', '#FF0099', '#FF0066', '#FF0033'  // Magenta to Red
];

const RainbowText: React.FC<TitleProps> = ({ children, interval = 200 }) => {
    const [colorIndex, setColorIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setColorIndex((prev) => (prev + 1) % COLORS.length);
        }, interval);

        return () => clearInterval(timer);
    }, [interval]);

    return <Text color={COLORS[colorIndex]}>{children}</Text>;
};

export default RainbowText;
