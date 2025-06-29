import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import ChatView from './ChatView.jsx';
import InitializationView from './InitializationView.jsx';
import WorkflowSelector from './WorkflowSelector.jsx';
import { logger } from '../utils/logger.js';

const App = ({ featureArchitect }) => {
  const { exit } = useApp();
  const [appState, setAppState] = useState('initializing'); // initializing, awaiting_workflow_selection, planning, completed, error
  const [statusMessage, setStatusMessage] = useState('Starting Codeplot...');
  const [errorMessage, setErrorMessage] = useState(null);
  const [repomixSummary, setRepomixSummary] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isStreamingAnalysis, setIsStreamingAnalysis] = useState(false);
  const [streamingAnalysis, setStreamingAnalysis] = useState('');

  useEffect(() => {
    const initialize = async () => {
      try {
        logger.debug('App: Starting initialization with injected FeatureArchitect');
        setStatusMessage('Initializing Feature Architect...');

        setStatusMessage('Packing repository with repomix...');

        // Pack the codebase
        logger.debug('App: Packing codebase');
        const packResult = await featureArchitect.repoPackager.pack();
        setRepomixSummary(packResult.summary);

        // Initialize AI chat session
        try {
          logger.debug('App: Initializing AI chat session');
          const initResult = await featureArchitect.chatSession.initialize(packResult.content);

          if (initResult.isNewSession && initResult.analysis) {
            logger.debug('App: Got AI analysis for new session');
            setAiAnalysis(initResult.analysis);
          }
        } catch (error) {
          logger.errorWithStack(error, 'AI initialization failed');
          if (!process.env.DEBUG) {
            setErrorMessage('AI initialization failed. Check debug log for details.');
            setAppState('error');
            return;
          }
        }

        // Switch to workflow selection
        logger.debug('App: Initialization complete, switching to workflow selection state');
        setAppState('awaiting_workflow_selection');
      } catch (error) {
        logger.errorWithStack(error, 'App initialization failed');
        if (!process.env.DEBUG) {
          setErrorMessage('Initialization failed. Run with --debug for details.');
          setAppState('error');
        }
      }
    };

    initialize();
  }, [featureArchitect]);

  const handlePlanningComplete = async featureData => {
    try {
      logger.debug('App: Planning complete, starting session completion', { featureData });
      setAppState('completing');
      setStatusMessage('Finalizing session...');

      // Complete the session through FeatureArchitect
      const result = await featureArchitect.completeSession(featureData);
      logger.info('App: Session completed successfully', { adrPath: result.adrPath });

      setStatusMessage(`✅ ADR generated: ${result.adrPath}`);
      setAppState('completed');

      // Auto-exit after a brief moment
      setTimeout(() => {
        logger.debug('App: Auto-exiting application');
        exit();
      }, 2000);
    } catch (error) {
      logger.errorWithStack(error, 'Session completion failed');
      if (!process.env.DEBUG) {
        setErrorMessage('Session completion failed. Check debug log for details.');
        setAppState('error');
      }
    }
  };

  const handleError = error => {
    logger.errorWithStack(error, 'App: Handled error from child component');
    if (!process.env.DEBUG) {
      setErrorMessage('An error occurred. Run with --debug for details.');
      setAppState('error');
    }
  };

  if (appState === 'error') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="single" borderColor="red" padding={1}>
          <Text color="red" bold>
            ❌ Error
          </Text>
        </Box>
        <Box padding={1}>
          <Text color="red">{errorMessage}</Text>
        </Box>
        <Box padding={1}>
          <Text color="gray">Debug log: {logger.getLogFilePath()}</Text>
        </Box>
        <Box padding={1}>
          <Text color="gray">Press Ctrl+C to exit</Text>
        </Box>
      </Box>
    );
  }

  if (appState === 'initializing') {
    return (
      <InitializationView
        statusMessage={statusMessage}
        repomixSummary={repomixSummary}
        aiAnalysis={aiAnalysis}
        isStreamingAnalysis={isStreamingAnalysis}
        streamingAnalysis={streamingAnalysis}
      />
    );
  }

  if (appState === 'completing') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="single" padding={1}>
          <Text color="blue" bold>
            📊 Codeplot
          </Text>
          <Text color="gray"> - AI-powered feature planning</Text>
        </Box>
        <Box padding={1}>
          <Text color="yellow">🔄 {statusMessage}</Text>
        </Box>
      </Box>
    );
  }

  if (appState === 'completed') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="single" borderColor="green" padding={1}>
          <Text color="green" bold>
            🎉 Feature Planning Completed!
          </Text>
        </Box>
        <Box padding={1}>
          <Text color="green">{statusMessage}</Text>
        </Box>
        <Box padding={1}>
          <Text color="gray">Exiting...</Text>
        </Box>
      </Box>
    );
  }

  if (appState === 'awaiting_workflow_selection') {
    return (
      <WorkflowSelector
        onSelect={item => {
          featureArchitect.agentOrchestrator.setWorkflow(item.value);
          setAppState('planning');
        }}
      />
    );
  }

  if (appState === 'planning' && featureArchitect) {
    return (
      <ChatView
        chatSession={featureArchitect.chatSession}
        onComplete={handlePlanningComplete}
        onError={handleError}
        repomixSummary={repomixSummary}
        aiAnalysis={aiAnalysis}
      />
    );
  }

  return (
    <Box padding={1}>
      <Text color="gray">Loading...</Text>
    </Box>
  );
};

export default App;
