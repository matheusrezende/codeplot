import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import ChatView from './ChatView.jsx';
import InitializationView from './InitializationView.jsx';
import { FeatureArchitect } from '../feature-architect.js';
import { logger } from '../utils/logger.js';

const App = ({ options }) => {
  const { exit } = useApp();
  const [appState, setAppState] = useState('initializing'); // initializing, planning, completed, error
  const [statusMessage, setStatusMessage] = useState('Starting Codeplot...');
  const [errorMessage, setErrorMessage] = useState(null);
  const [featureArchitect, setFeatureArchitect] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [repomixSummary, setRepomixSummary] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isStreamingAnalysis, setIsStreamingAnalysis] = useState(false);
  const [streamingAnalysis, setStreamingAnalysis] = useState('');

  useEffect(() => {
    const initialize = async () => {
      try {
        logger.debug('App: Starting initialization', { options: { ...options, apiKey: '[REDACTED]' } });
        setStatusMessage('Initializing Feature Architect...');
        
        // Create FeatureArchitect instance
        logger.debug('App: Creating FeatureArchitect instance');
        const architect = new FeatureArchitect(options);
        setFeatureArchitect(architect);
        
        setStatusMessage('Setting up session management...');
        
        // Initialize state machine and handle session selection
        logger.debug('App: Creating state machine');
        const stateMachine = architect.createStateMachine();
        
        let sessionChoice = null;
        if (options.session) {
          logger.debug('App: Loading specific session', { session: options.session });
          setStatusMessage(`Loading session: ${options.session}`);
          await stateMachine.loadSession(options.session);
        } else {
          setStatusMessage('Checking for existing sessions...');
          logger.debug('App: Getting session choice');
          sessionChoice = await architect.sessionManager.getSessionChoice();
          
          if (sessionChoice === 'new') {
            logger.debug('App: Starting new session');
            setStatusMessage('Starting new session...');
          } else if (sessionChoice) {
            logger.debug('App: Loading existing session', { sessionChoice });
            setStatusMessage(`Loading session: ${sessionChoice}`);
          }
          
          await stateMachine.loadSession(null, sessionChoice);
        }

        setStatusMessage('Packing repository with repomix...');
        
        // Transition to CODEBASE_PACKED state and get repomix summary
        logger.debug('App: Transitioning to CODEBASE_PACKED state');
        await stateMachine.transitionTo(stateMachine.states.CODEBASE_PACKED);
        
        // Get the repomix summary from the state machine
        if (stateMachine.repomixSummary) {
          logger.debug('App: Got repomix summary', { summaryLength: stateMachine.repomixSummary.length });
          setRepomixSummary(stateMachine.repomixSummary);
        }
        
        // Transition to PLANNING state
        logger.debug('App: Transitioning to PLANNING state');
        await stateMachine.transitionTo(stateMachine.states.PLANNING);
        
        const stateInfo = stateMachine.getStateInfo();
        setSessionInfo(stateInfo);
        
        // Initialize AI without codebase analysis
        try {
          logger.debug('App: Initializing AI chat session');
          const initResult = await architect.chatSession.initialize(
            stateMachine.codebaseContent, 
            stateMachine.sessionData
          );
          
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
        
        // Switch to chat interface
        logger.debug('App: Initialization complete, switching to planning state');
        setAppState('planning');
        
      } catch (error) {
        logger.errorWithStack(error, 'App initialization failed');
        if (!process.env.DEBUG) {
          setErrorMessage('Initialization failed. Run with --debug for details.');
          setAppState('error');
        }
      }
    };

    initialize();
  }, []);

  const handlePlanningComplete = async (featureData) => {
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

  const handleError = (error) => {
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
          <Text color="red" bold>❌ Error</Text>
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
          <Text color="blue" bold>📊 Codeplot</Text>
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
          <Text color="green" bold>🎉 Feature Planning Completed!</Text>
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

  if (appState === 'planning' && featureArchitect && sessionInfo) {
    return (
      <ChatView
        chatSession={featureArchitect.chatSession}
        sessionManager={featureArchitect.sessionManager}
        sessionName={sessionInfo.sessionName}
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
