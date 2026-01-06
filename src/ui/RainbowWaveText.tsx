import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

const COLORS = [
    '#FF0000', '#FF3300', '#FF6600', '#FF9900', '#FFCC00', // Red to Yellow
    '#FFFF00', '#CCFF00', '#99FF00', '#66FF00', '#33FF00', // Yellow to Green
    '#00FF00', '#00FF33', '#00FF66', '#00FF99', '#00FFCC', // Green to Cyan
    '#00FFFF', '#00CCFF', '#0099FF', '#0066FF', '#0033FF', // Cyan to Blue
    '#0000FF', '#3300FF', '#6600FF', '#9900FF', '#CC00FF', // Blue to Magenta
    '#FF00FF', '#FF00CC', '#FF0099', '#FF0066', '#FF0033'  // Magenta to Red
];

interface RainbowWaveTextProps {
    children: React.ReactNode;
    interval?: number;
}

const RainbowWaveText: React.FC<RainbowWaveTextProps> = ({ children, interval = 80 }) => {
    const [colorIndex, setColorIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setColorIndex((prev) => (prev + 1) % COLORS.length);
        }, interval);

        return () => clearInterval(timer);
    }, [interval]);

    // Flatten children to text - safely handle string/number
    const text = React.Children.toArray(children)
        .map(child => typeof child === 'string' || typeof child === 'number' ? String(child) : '')
        .join('');

    return (
        <Text>
            {text.split('').map((char, i) => {
                // Reverse wave calculation
                // To make it flow opposite to normal, we subtract 'i'.
                // We add COLORS.length * 10 to ensure the index is always positive before modulo.
                const index = (colorIndex - i + (COLORS.length * 10)) % COLORS.length;
                return (
                    <Text key={`${i}-${char}`} color={COLORS[index]}>
                        {char}
                    </Text>
                );
            })}
        </Text>
    );
};

export default RainbowWaveText;
