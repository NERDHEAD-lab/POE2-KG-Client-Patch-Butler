/**
 * Calculates the display width of a string in the terminal.
 * Assigns 2 columns for CJK characters and 1 column for others.
 */
export const getStringWidth = (str: string): number => {
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
