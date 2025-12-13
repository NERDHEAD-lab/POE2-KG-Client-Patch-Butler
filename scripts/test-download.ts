import { downloadFiles } from '../src/utils/downloader.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const main = async () => {
    const webRoot = 'https://patch.poe2.kakaogames.com/production/patch/4.4.0.1/';
    const fileName = 'PathOfExile_KG.exe';

    // Create a temp download folder in scripts/temp
    const installPath = path.join(__dirname, 'temp_download');
    if (!fs.existsSync(installPath)) {
        fs.mkdirSync(installPath);
    }

    console.log(`Testing download of ${fileName}...`);
    console.log(`Web Root: ${webRoot}`);
    console.log(`Target: ${path.join(installPath, fileName)}`);

    try {
        await downloadFiles(
            webRoot,
            webRoot, // backup same
            [fileName],
            installPath,
            (progress) => {
                // process.stdout.write(`\rDownloading: ${progress.percentage}% ms`);
            }
        );
        console.log('\nDownload SUCCESS!');

        // Check file size
        const stats = fs.statSync(path.join(installPath, fileName));
        console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    } catch (e: any) {
        console.error('\nDownload FAILED:');
        console.error(e.message);
        if (e.response) {
            console.error('Status:', e.response.status);
            console.error('Headers:', e.response.headers);
        }
        console.error(e.stack);
        process.exit(1);
    }
};

main();
