import React from 'react';
import { Text } from 'ink';
import { TitleProps } from './types.js';

const SimpleText: React.FC<TitleProps> = ({ children, color = 'white' }) => {
    return <Text color={color}>{children}</Text>;
};

export default SimpleText;
