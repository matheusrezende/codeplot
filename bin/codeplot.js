#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the main source file
const mainFile = join(__dirname, '..', 'src', 'index.js');

// Find tsx executable - prefer local installation, fallback to global
const localTsx = join(__dirname, '..', 'node_modules', '.bin', 'tsx');
const tsxCommand = existsSync(localTsx) ? localTsx : 'tsx';

// Use tsx to run the TypeScript/JSX file
const child = spawn(tsxCommand, [mainFile, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

child.on('close', code => {
  process.exit(code);
});

child.on('error', err => {
  if (err.code === 'ENOENT') {
    console.error(
      'Error: tsx is not available. This should not happen in a properly installed package.'
    );
    console.error('Please report this issue at: https://github.com/matheusrezende/codeplot/issues');
    process.exit(1);
  } else {
    console.error('Error starting application:', err.message);
    process.exit(1);
  }
});
