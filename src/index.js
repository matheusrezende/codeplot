#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { FeatureArchitect } from './feature-architect.js';

const program = new Command();

program
  .name('codeplot')
  .description('Interactive CLI tool for feature planning and ADR generation using Gemini 2.5 Pro')
  .version('1.0.0');

program
  .command('plan')
  .description('Start interactive feature planning session')
  .option('-p, --project-path <path>', 'Path to the project repository', process.cwd())
  .option('-k, --api-key <key>', 'Gemini API key (or set GEMINI_API_KEY env var)')
  .option('-o, --output-dir <dir>', 'Output directory for ADRs', './doc/adr')
  .option('-s, --session <path>', 'Load specific session file to resume conversation')
  .option('--no-streaming', 'Disable streaming responses (show all at once)')
  .option('--typing-speed <speed>', 'Typing speed for streaming: fast, normal, slow', 'normal')
  .action(async options => {
    try {
      const architect = new FeatureArchitect(options);
      await architect.start();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize the CLI tool configuration')
  .action(async () => {
    console.log(chalk.blue('📊  Codeplot CLI'));
    console.log(chalk.gray('Plot your features with AI-powered planning and ADR generation'));
    console.log();
    console.log(chalk.yellow('Setup:'));
    console.log('1. Install repomix: npm install -g repomix');
    console.log('2. Install adr-tools: npm install -g adr-tools');
    console.log('3. Set your Gemini API key: export GEMINI_API_KEY=your_api_key');
    console.log();
    console.log(chalk.green('Usage:'));
    console.log('codeplot plan --project-path /path/to/your/project');
  });

program.parse();
