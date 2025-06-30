import React, { useState, useEffect } from 'react';
import { Text, useApp } from 'ink';
import { IAgentService } from '../services/agent/agent.interface';
import { ILoggerService } from '../services/logger/logger.interface';
import { IMcpService } from '../services/mcp/mcp.interface';
import { AgentSelector } from './AgentSelector';
import { ChatWindow } from './ChatWindow';

type AppState = 'selecting-agent' | 'initializing' | 'chatting' | 'error';

interface AppProps {
  logger: ILoggerService;
  mcpService: IMcpService;
  agentService: IAgentService;
}

export function App({ logger, mcpService, agentService }: AppProps) {
  const { exit } = useApp();
  const [appState, setAppState] = useState<AppState>('selecting-agent');
  const [selectedAgent, setSelectedAgent] = useState<'dev' | 'pm' | null>(null);

  useEffect(() => {
    if (appState === 'initializing' && selectedAgent) {
      const initialize = async () => {
        logger.info(`User selected the ${selectedAgent === 'dev' ? 'Developer' : 'PM'} Agent.`);
        try {
          await mcpService.connect();
          const tools = mcpService.getTools();
          await agentService.initialize(selectedAgent, tools);
          logger.info('Agent initialized successfully.');
          setAppState('chatting');
        } catch (error) {
          logger.error(`Failed to initialize agent: ${error}`, error);
          setAppState('error');
        }
      };
      initialize();
    }
  }, [appState, selectedAgent, agentService, logger, mcpService]);

  const handleAgentSelect = (agentType: 'dev' | 'pm') => {
    setSelectedAgent(agentType);
    setAppState('initializing');
  };

  if (appState === 'selecting-agent') {
    return <AgentSelector onSelect={handleAgentSelect} />;
  }

  if (appState === 'initializing') {
    return <Text>Initializing agent...</Text>;
  }
  if (appState === 'chatting') {
    return <ChatWindow agentService={agentService} onExit={exit} />;
  }

  if (appState === 'error') {
    return <Text color="red">An error occurred during initialization. Please check the logs.</Text>;
  }

  return <Text>Unknown application state.</Text>;
}
