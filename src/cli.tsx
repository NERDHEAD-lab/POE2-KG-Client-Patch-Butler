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
		restoreUac: {
			type: 'boolean'
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
} else if (cli.flags.restoreUac) {
	const { disableUACBypass, isUACBypassEnabled } = await import('./utils/uac.js');
	const { stopServer } = await import('./utils/server.js');
	
    logger.info('Received request to restore UAC settings via CLI...');
    
    // Check if bypass is actually enabled to avoid unnecessary prompt/operations
    const enabled = await isUACBypassEnabled();
    if (!enabled) {
        logger.info('UAC Bypass is not active. Skipping restoration.');
        process.exit(0);
    }

	const success = await disableUACBypass();
	
	if (success) {
		logger.success('UAC restoration via CLI completed successfully.');
		process.exit(0);
	} else {
		logger.error('UAC restoration via CLI failed.');
		process.exit(1);
	}
	// Stop server (though process.exit will kill it anyway)
	stopServer();
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
