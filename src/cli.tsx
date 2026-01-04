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
    logger.error('Failed to start local server:', e);
}

if (cli.flags.watch) {
	logger.setSuffix('watcher');
    // Watcher mode doesn't need to pass port anywhere visually, 
    // but the server is running for the extension to find.
	startWatcher();
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
