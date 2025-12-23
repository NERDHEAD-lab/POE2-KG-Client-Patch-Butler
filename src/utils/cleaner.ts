import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

export function getShaderCachePaths(): string[] {
    const appData = process.env.APPDATA;
    if (!appData) return [];

    const poe2Path = path.join(appData, 'Path of Exile 2');
    if (!fs.existsSync(poe2Path)) {
        logger.info(`Shader cache check: '${poe2Path}' does not exist.`);
        return [];
    }

    const targets = ['ShaderCacheD3D12', 'ShaderCacheVulkan'];
    const found: string[] = [];

    targets.forEach(t => {
        const fullPath = path.join(poe2Path, t);
        if (fs.existsSync(fullPath)) {
            found.push(fullPath);
        }
    });

    logger.info(`Shader cache check: Found ${found.length} directories.`);
    return found;
}

export async function clearShaderCache(paths: string[]): Promise<void> {
    for (const p of paths) {
        if (fs.existsSync(p)) {
            try {
                logger.info(`Deleting shader cache: ${p}`);
                await fs.promises.rm(p, { recursive: true, force: true });
                logger.success(`Deleted: ${p}`);
            } catch (e) {
                logger.error(`Failed to delete ${p}: ${e}`);
                throw e;
            }
        }
    }
}
