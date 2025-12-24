import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const exePath = path.join(rootDir, 'node_modules', 'trayicon', 'rsrcs', 'trayicon.exe');
const outputPath = path.join(rootDir, 'src', 'generated', 'trayAppBase64.ts');

if (!fs.existsSync(exePath)) {
    console.error('Error: Tray executable not found at', exePath);
    console.error('Please run "npm install" to ensure devDependencies are installed.');
    process.exit(1);
}

const exeBuffer = fs.readFileSync(exePath);
const base64String = exeBuffer.toString('base64');

const tsContent = `export const TRAY_APP_BASE64 = '${base64String}';\n`;

fs.writeFileSync(outputPath, tsContent);
console.log(`Tray App Base64 generated at: ${outputPath}`);
