#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import App from './ui/App.js';
import { startWatcher } from './watcher.js';

import { checkSingleInstance } from './utils/singleInstance.js';

const cli = meow(`
	Usage
	  $ poe2-patch-butler

	Options
	  --watch                Start in background watcher mode
      --fix-patch            Start directly in Patch Fix mode
      --disable-all-configs  Reset all configurations (cleanup)
      --cleanup-target       Specify target for cleanup (default: all)

	Examples
	  $ poe2-patch-butler --watch
`, {
	flags: {
		watch: {
			type: 'boolean'
		},
		fixPatch: {
			type: 'boolean'
		},
        disableAllConfigs: {
            type: 'boolean'
        },
        cleanupTarget: {
            type: 'string'
        }
	},
	importMeta: import.meta,
});

import { logger } from './utils/logger.js';
import { runMigrations } from './utils/migrations.js';

// Shared Error Handler
const handleErrorAndWait = async (e: unknown) => {
    logger.error('치명적 오류: 애플리케이션 충돌: ' + e);
    console.error(e);
    
    console.log('\nPress Enter to exit...');
    
    try {
        const { createInterface } = await import('readline');
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question('', () => {
            rl.close();
            process.exit(1);
        });
    } catch (err) {
        process.exit(1);
    }
};

// Global handlers for runtime crashes
process.on('uncaughtException', (err) => {
    handleErrorAndWait(err);
});

process.on('unhandledRejection', (reason) => {
    handleErrorAndWait(reason);
});

// Wrap in main to catch top-level errors
const main = async () => {
    try {
        // Run migrations before anything else
        await runMigrations();

        // Start Local Server for Extension Communication (Both Watcher & UI Mode)
        let serverPort = 0;
        try {
            const { startServer } = await import('./utils/server.js');
            serverPort = (await startServer()) as number;
        } catch (e) {
            logger.error('로컬 서버 시작 실패: ' + String(e));
        }

        if (cli.flags.watch) {
            logger.setSuffix('watcher');
            // but the server is running for the extension to find.
            startWatcher();
        } else if (cli.flags.disableAllConfigs) {
            logger.enableConsole();
            const { performFullCleanup } = await import('./utils/configCleanup.js');
            const target = cli.flags.cleanupTarget as any; 
            await performFullCleanup(target || 'all');
            
            // Add a small delay so user can read the last message
            await new Promise(resolve => setTimeout(resolve, 1500));
            process.exit(0);
        } else {
            // Check for existing instance (Close others if fix-patch, else Focus existing)
            const shouldStart = await checkSingleInstance(cli.flags.fixPatch ?? false);
            if (!shouldStart) {
                const { stopServer } = await import('./utils/server.js');
                stopServer();
                process.exit(0);
            }

            process.title = 'POE2 Patch Butler';
            render(<App initialMode={cli.flags.fixPatch ? 'FIX_PATCH' : 'NORMAL'} serverPort={serverPort} />);
        }
    } catch (e) {
        handleErrorAndWait(e);
    }
};

main();
