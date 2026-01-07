import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

/**
 * @file shaderCacheCleaner.ts
 * @description
 * Utility module specifically for managing Path of Exile 2's Shader Cache.
 * It handles the detection and deletion of 'ShaderCache' directories located in AppData/Roaming.
 * This is used to resolve graphical glitches or crashing issues caused by corrupted cache.
 */

export function getShaderCachePaths(): string[] {
    const appData = process.env.APPDATA;
    if (!appData) return [];

    const poe2Path = path.join(appData, 'Path of Exile 2');
    if (!fs.existsSync(poe2Path)) {
        logger.info(`쉐이더 캐시 확인: '${poe2Path}' 경로가 존재하지 않습니다.`);
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

    logger.info(`쉐이더 캐시 확인: ${found.length}개의 폴더를 발견했습니다.`);
    return found;
}

export async function clearShaderCache(paths: string[]): Promise<void> {
    for (const p of paths) {
        if (fs.existsSync(p)) {
            try {
                logger.info(`쉐이더 캐시 삭제 중: ${p}`);
                await fs.promises.rm(p, { recursive: true, force: true });
                logger.success(`삭제됨: ${p}`);
            } catch (e) {
                logger.error(`삭제 실패 ${p}: ${e}`);
                throw e;
            }
        }
    }
}
