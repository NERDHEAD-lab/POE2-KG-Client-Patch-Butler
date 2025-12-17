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

if (cli.flags.watch) {
	startWatcher();
} else {
	// Check for existing instance (Close others if fix-patch, else Focus existing)
	const shouldStart = await checkSingleInstance(cli.flags.fixPatch ?? false);
	if (!shouldStart) {
		process.exit(0);
	}

	process.title = 'POE2 Patch Butler';
	render(<App initialMode={cli.flags.fixPatch ? 'FIX_PATCH' : 'NORMAL'} />);
}
