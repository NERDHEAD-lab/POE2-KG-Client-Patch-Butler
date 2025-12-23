import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const exeName = 'poe2-patch-butler.exe';
const exePath = path.join(rootDir, exeName);

function runCommand(command) {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit', cwd: rootDir });
}

async function main() {
    try {
        // 1. Bundle with tsup (ESM)
        console.log('--- Bundling (ESM) ---');
        runCommand('npm run bundle');

        // 2. Create CJS Wrapper for SEA (Temp File Strategy)
        console.log('--- Creating CJS Loader Wrapper ---');
        const mjsPath = path.join(distDir, 'cli.mjs');
        const mjsContent = fs.readFileSync(mjsPath, 'base64');

        const loaderContent = `
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');

const code = "${mjsContent}";
const tempDir = os.tmpdir();
const tempFile = path.join(tempDir, 'poe2-butler-' + Date.now() + '.mjs');

try {
    fs.writeFileSync(tempFile, Buffer.from(code, 'base64'));
} catch (e) {
    console.error('Failed to write temp file:', e);
    process.exit(1);
}

(async () => {
    try {
        const fileUrl = pathToFileURL(tempFile).href;
        await import(fileUrl);
    } catch (e) {
        console.error('Failed to run app:', e);
    } finally {
        // Cleanup logic could go here
    }
})();

process.on('exit', () => {
    try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    } catch (e) {}
});
    `;

        // Write loader to dist/cli.cjs (Force CJS interpretation)
        const loaderPath = path.join(distDir, 'cli.cjs');
        fs.writeFileSync(loaderPath, loaderContent);

        // 3. Generate Blob from Loader
        console.log('--- Generating Blob ---');
        runCommand('node --experimental-sea-config sea-config.json');

        // 4. Prepare Executable
        console.log('--- Creating Executable ---');
        fs.copyFileSync(process.execPath, exePath);
        console.log(`Copied Node.js binary to ${exeName}`);

        // 5. Inject Blob
        console.log('--- Injecting Blob ---');
        runCommand(`npx postject ${exeName} NODE_SEA_BLOB dist/cli.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`);

        // 6. Inject Icon
        console.log('--- Injecting Icon ---');

        const packageJson = require(path.join(rootDir, 'package.json'));
        const version = packageJson.version; // 1.0.0
        //windows version format: n.n.n -> n.n.n.0
        const winVersion = version + '.0';

        const iconPath = path.resolve(rootDir, 'assets', 'icon.ico');
        if (!fs.existsSync(iconPath)) {
            console.log('Icon not found, skipping injection.');
            return;
        }
        try {
            const reseditCmd = [
                `npx resedit`,
                `--in "${exeName}"`,
                `--out "${exeName}"`,
                `--icon 1,"${iconPath}"`,
                `--file-version ${winVersion}`,
                `--product-version ${winVersion}`,
                `--company-name "NERDHEAD LAB"`,
                `--file-description "POE2 카카오게임즈 클라이언트 오류 수정 도구"`,
                `--product-name "POE2 Patch Butler"`,
                `--ignore-signed`,
            ].join(' ');

            runCommand(reseditCmd);
        } catch (e) {
            console.warn('Failed to inject icon:', e);
        }

        console.log('--- Build Complete ---');
        console.log(`Executable created at: ${exePath}`);

        // 7. Create Installer (Optional)
        // Check if innosetup-compiler is available
        try {
            console.log('--- Creating Installer ---');
            const innosetupCompiler = require('innosetup-compiler');
            const issPath = path.resolve(rootDir, 'scripts', 'installer.iss');

            await new Promise((resolve, reject) => {
                innosetupCompiler(issPath, {
                    gui: false,
                    verbose: true,
                    DMyAppVersion: version,
                }, (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
            console.log('Installer created successfully!');
        } catch (e) {
            console.warn('Failed to create installer (Inno Setup might not be installed or configured):', e.message);
            console.log('Skipping installer creation.');
        }

    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

main();
