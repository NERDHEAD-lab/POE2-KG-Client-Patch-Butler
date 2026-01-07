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
	  --watch      Start in background watcher mode
      --fix-patch  Start directly in Patch Fix mode

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

// Run migrations before anything else
import { runMigrations } from './utils/migrations.js';
await runMigrations();

// Start Local Server for Extension Communication (Both Watcher & UI Mode)
let serverPort = 0;
try {
    const { startServer } = await import('./utils/server.js');
    serverPort = (await startServer()) as number;
} catch (e) {
    logger.error('Failed to start local server: ' + String(e));
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
