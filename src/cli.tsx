#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import App from './ui/App.js';
import { startWatcher } from './watcher.js';

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
	render(<App initialMode={cli.flags.fixPatch ? 'FIX_PATCH' : 'NORMAL'} />);
}
