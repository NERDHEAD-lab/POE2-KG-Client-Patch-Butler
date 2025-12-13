#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import App from './ui/App.js';

const cli = meow(`
	Usage
	  $ poe2-patch-butler

	Options
	  --name  Your name

	Examples
	  $ poe2-patch-butler
`, {
	flags: {
		name: {
			type: 'string'
		}
	},
	importMeta: import.meta,
});

render(<App />);
