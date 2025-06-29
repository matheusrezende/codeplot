#!/usr/bin/env node

import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import App from './ui/App.jsx';
import { logger } from './utils/logger.js';

interface PlanOptions {
  projectPath: string;
  apiKey?: string;
  outputDir: string;
  streaming: boolean;
  typingSpeed: string;
  debug?: boolean;
  logLevel?: string;
}

interface EnvironmentInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  cwd: string;
}

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
  .option('--no-streaming', 'Disable streaming responses (show all at once)')
  .option('--typing-speed <speed>', 'Typing speed for streaming: fast, normal, slow', 'normal')
  .option('--debug', 'Enable debug mode with verbose logging and stack traces')
  .option('--log-level <level>', 'Set log level: error, warn, info, debug, trace', 'info')
  .action(async (options: PlanOptions) => {
    try {
      // Set environment variables for debug mode and log level
      if (options.debug) {
        process.env.DEBUG = 'true';
      }
      if (options.logLevel) {
        process.env.LOG_LEVEL = options.logLevel;
      }

      const environmentInfo: EnvironmentInfo = {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd(),
      };

      logger.info('Starting codeplot application', {
        options: { ...options, apiKey: options.apiKey ? '[REDACTED]' : undefined },
        environment: environmentInfo,
      });

      // Validate required options
      if (!options.apiKey && !process.env.GEMINI_API_KEY) {
        const error = new Error(
          'Gemini API key is required. Set GEMINI_API_KEY environment variable or use --api-key option.'
        );
        logger.errorWithStack(error, 'Missing API key');
        return; // errorWithStack will throw in debug mode
      }

      // Set up global error handlers
      setupGlobalErrorHandlers();

      // Render the ink App component
      logger.debug('Rendering React App component');
      render(React.createElement(App, { options }));
    } catch (error) {
      logger.errorWithStack(error as Error, 'Failed to start application');
      // In non-debug mode, show user-friendly error and exit
      if (!process.env.DEBUG) {
        console.error('❌ Application failed to start. Run with --debug for more details.');
        console.error(`Debug log saved to: ${logger.getLogFilePath()}`);
        process.exit(1);
      }
    }
  });

program
  .command('init')
  .description('Initialize the CLI tool configuration')
  .action(async () => {
    console.log('📊  Codeplot CLI');
    console.log('Plot your features with AI-powered planning and ADR generation');
    console.log();
    console.log('Setup:');
    console.log('1. Install repomix: npm install -g repomix');
    console.log('2. Install adr-tools: npm install -g adr-tools');
    console.log('3. Set your Gemini API key: export GEMINI_API_KEY=your_api_key');
    console.log();
    console.log('Usage:');
    console.log('codeplot plan --project-path /path/to/your/project');
  });

// Global error handlers setup
function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.errorWithStack(error, 'Uncaught Exception');
    if (!process.env.DEBUG) {
      console.error('❌ Unexpected error occurred. Debug log saved to:', logger.getLogFilePath());
      process.exit(1);
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.errorWithStack(error, 'Unhandled Promise Rejection', { promise });
    if (!process.env.DEBUG) {
      console.error('❌ Unexpected error occurred. Debug log saved to:', logger.getLogFilePath());
      process.exit(1);
    }
  });

  // Handle process warnings
  process.on('warning', (warning: Error) => {
    logger.warn('Process Warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    });
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    process.exit(0);
  });
}

program.parse();
