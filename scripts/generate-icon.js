import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const iconPath = path.join(rootDir, 'assets', 'icon.ico');
const outputPath = path.join(rootDir, 'src', 'generated', 'iconBase64.ts');

if (!fs.existsSync(iconPath)) {
    console.error('Error: Icon file not found at', iconPath);
    process.exit(1);
}

const iconBuffer = fs.readFileSync(iconPath);
const base64String = iconBuffer.toString('base64');

const tsContent = `export const ICON_BASE64 = '${base64String}';\n`;

fs.writeFileSync(outputPath, tsContent);
console.log(`Icon Base64 generated at: ${outputPath}`);
