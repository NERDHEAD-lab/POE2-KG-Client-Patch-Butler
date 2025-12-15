import fs from 'fs';
import path from 'path';

export function getShaderCachePaths(): string[] {
    const appData = process.env.APPDATA;
    if (!appData) return [];

    const poe2Path = path.join(appData, 'Path of Exile 2');
    if (!fs.existsSync(poe2Path)) return [];

    const targets = ['ShaderCacheD3D12', 'ShaderCacheVulkan'];
    const found: string[] = [];

    targets.forEach(t => {
        const fullPath = path.join(poe2Path, t);
        if (fs.existsSync(fullPath)) {
            found.push(fullPath);
        }
    });

    return found;
}

export async function clearShaderCache(paths: string[]): Promise<void> {
    for (const p of paths) {
        if (fs.existsSync(p)) {
            await fs.promises.rm(p, { recursive: true, force: true });
        }
    }
}
