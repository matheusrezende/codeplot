#!/usr/bin/env node
import 'reflect-metadata';
import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import container from './container';
import { ILoggerService } from './services/logger/logger.interface';
import { IMcpService } from './services/mcp/mcp.interface';
import { AgentServiceToken, IAgentService } from './services/agent/agent.interface';
import { App } from './components/App';

const program = new Command();

program
  .version('0.0.1')
  .description('An agent-powered CLI for software development tasks.')
  .option('--debug', 'Enable debug logging');

program
  .command('plan')
  .description('Start a planning session with an AI agent.')
  .action(async () => {
    const logger = container.resolve<ILoggerService>('ILoggerService');
    const mcpService = container.resolve<IMcpService>('IMcpService');
    const agentService = container.resolve<IAgentService>(AgentServiceToken);

    // Handle Ctrl+C at the process level
    let ctrlCCount = 0;
    const handleCtrlC = async () => {
      ctrlCCount++;
      console.log(`\nPress Ctrl+C again to exit (${ctrlCCount}/2)`);

      if (ctrlCCount >= 2) {
        console.log('\nExiting...');
        await mcpService.disconnect();
        process.exit(0);
      }

      // Reset count after 2 seconds
      setTimeout(() => {
        ctrlCCount = 0;
      }, 2000);
    };

    process.on('SIGINT', handleCtrlC);

    const app = render(React.createElement(App, { logger, mcpService, agentService }), {
      stdout: process.stderr,
    });

    process.on('exit', () => {
      // Note: exit handlers must be synchronous, so we can't await here
      // The MCP connections should be properly closed through other means
      mcpService.disconnect().catch(() => {
        // Ignore errors during shutdown
      });
      app.unmount();
    });

    await app.waitUntilExit();
  });

program.parse(process.argv);
