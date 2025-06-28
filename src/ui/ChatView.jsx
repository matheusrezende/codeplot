import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import AIResponse from './AIResponse.jsx';
import MarkdownText from './MarkdownText.jsx';
import { AgentOrchestrator } from '../agents/AgentOrchestrator.js';

const ChatView = ({ chatSession, sessionManager, sessionName, onComplete, onError, repomixSummary, aiAnalysis }) => {
  const { exit } = useApp();
  const [messages, setMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  const [isStreamingAI, setIsStreamingAI] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [mode, setMode] = useState('planning'); // 'planning', 'adr_generation', 'completed'
  const [featureDescription, setFeatureDescription] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [inputMode, setInputMode] = useState('text'); // 'text' or 'selector'
  const [lastAIResponse, setLastAIResponse] = useState('');
  const [agentOrchestrator, setAgentOrchestrator] = useState(null);
  const [currentResponseData, setCurrentResponseData] = useState(null);
  const scrollRef = useRef();

  // Helper function to start processing
  const startProcessing = () => {
    setIsWaitingForAI(true);
  };

  // Helper function to end processing
  const endProcessing = (response) => {
    setIsWaitingForAI(false);
    
    // Add the response as a message
    addMessage('assistant', response);
    
    // Check if this response has options
    const hasJsonOptions = response.match(/"options"\s*:\s*\[/) || response.match(/```(?:json)?[\s\S]*"options"/);
    const hasNumberedOptions = response.match(/^\s*\d+\./m);
    
    if (hasJsonOptions || hasNumberedOptions) {
      setLastAIResponse(response);
      setInputMode('selector');
    }
  };

  // Watch for AI analysis updates
  useEffect(() => {
    if (aiAnalysis && messages.length > 0) {
      // Check if AI analysis message already exists
      const hasAIAnalysis = messages.some(msg => 
        msg.type === 'assistant' && msg.content.includes('Codebase Analysis')
      );
      
      if (!hasAIAnalysis) {
        // Add AI analysis as a new message
        addMessage('assistant', aiAnalysis);
      }
    }
  }, [aiAnalysis]);

  // Initialize the chat session
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsInitializing(true);
        
        // Initialize AgentOrchestrator with API key from environment
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY environment variable is required');
        }
        
        const orchestrator = new AgentOrchestrator(apiKey);
        setAgentOrchestrator(orchestrator);
        
        // Check if session has existing data
        if (sessionName && chatSession.featureData.adr_content) {
          // Session already has completed ADR
          setMessages([
            {
              type: 'system',
              content: `Resuming session: ${chatSession.featureData.description || 'Unnamed Feature'}`,
              timestamp: new Date()
            },
            {
              type: 'system', 
              content: 'This session already has a completed ADR. You can review, modify, or exit.',
              timestamp: new Date()
            }
          ]);
          setMode('completed');
        } else if (sessionName && chatSession.featureData.description && !chatSession.featureData.adr_content) {
          // Resuming incomplete session
          setFeatureDescription(chatSession.featureData.description);
          setMessages([
            {
              type: 'system',
              content: `Resuming feature planning: ${chatSession.featureData.description}`,
              timestamp: new Date()
            },
            {
              type: 'system',
              content: 'The AI will continue asking clarifying questions. Answer them to refine the feature requirements.',
              timestamp: new Date()
            }
          ]);
          
          // Get next AI question
          startProcessing();
          const aiResponse = await chatSession.sendMessage(
            `I want to continue planning this feature: ${chatSession.featureData.description}. Please ask me your next clarifying question.`
          );
          endProcessing(aiResponse);
        } else {
          // New session - include repomix summary and AI analysis
          const initialMessages = [];
          
          // Add repomix summary if available
          if (repomixSummary) {
            initialMessages.push({
              type: 'system',
              content: `📦 Repository Analysis Complete

Files processed: ${repomixSummary.fileCount.toLocaleString()}
Total lines: ${repomixSummary.totalLines.toLocaleString()}
Content size: ${repomixSummary.sizeKB} KB
Estimated tokens: ${repomixSummary.estimatedTokens.toLocaleString()}${repomixSummary.sampleFiles.length > 0 ? `

Sample files:
${repomixSummary.sampleFiles.map(file => `• ${file}`).join('\n')}${repomixSummary.hasMoreFiles ? `\n... and ${repomixSummary.remainingCount} more files` : ''}` : ''}`,
              timestamp: new Date()
            });
          }
          
          // Add ready message (no initial AI analysis)
          initialMessages.push({
            type: 'system',
            content: 'Ready to start feature planning! What feature would you like to build? (Type "done" when finished)',
            timestamp: new Date()
          });
          
          setMessages(initialMessages);
        }
        
        setIsInitializing(false);
      } catch (error) {
        addMessage('system', `Error initializing chat: ${error.message}`);
        setIsInitializing(false);
        if (onError) {
          onError(error);
        }
      }
    };

    initialize();
  }, []);

  const addMessage = (type, content) => {
    setMessages(prev => [...prev, {
      type,
      content,
      timestamp: new Date()
    }]);
  };

  const handleSubmit = async (input) => {
    if (!input.trim()) return;

    const userInput = input.trim();
    addMessage('user', userInput);
    setCurrentInput('');
    setInputMode('text'); // Reset to text mode after user input

    // Handle different modes
    if (mode === 'completed') {
      await handleCompletedMode(userInput);
    } else if (mode === 'planning') {
      await handlePlanningMode(userInput);
    }
  };

  const handleOptionSelect = async (optionText, optionValue) => {
    // User selected an option from the AI response
    addMessage('user', optionText);
    setInputMode('text'); // Switch back to text mode
    setLastAIResponse(''); // Clear last AI response

    // Handle the selection based on current mode
    if (mode === 'planning') {
      await handlePlanningMode(optionText);
    } else if (mode === 'completed') {
      await handleCompletedMode(optionText);
    }
  };

  const handleContinueWithText = () => {
    // Switch from selector back to text input
    setInputMode('text');
    setLastAIResponse('');
  };

  const handleCompletedMode = async (input) => {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput === 'review') {
      addMessage('system', 'Current ADR Content:');
      addMessage('system', '='.repeat(80));
      addMessage('assistant', chatSession.featureData.adr_content);
      addMessage('system', '='.repeat(80));
      addMessage('system', 'You can type "modify" to make changes or "exit" to finish.');
    } else if (lowerInput === 'modify') {
      setMode('modification');
      addMessage('system', 'ADR Modification Mode');
      addMessage('system', 'You can ask questions about the current ADR, request changes, or explore alternatives.');
      
      startProcessing();
      const aiResponse = await chatSession.sendMessage(
        `I would like to review and potentially modify the current ADR. Here is the current ADR content:\n\n${chatSession.featureData.adr_content}\n\nI may want to make changes, explore alternatives, or ask questions about this ADR. Please help me refine it based on my feedback.`
      );
      endProcessing(aiResponse);
    } else if (lowerInput === 'exit' || lowerInput === 'done') {
      onComplete(chatSession.featureData);
      exit();
    } else {
      addMessage('system', 'Available commands: "review", "modify", "exit"');
    }
  };

  const handlePlanningMode = async (input) => {
    if (input.toLowerCase() === 'done') {
      await generateADR();
      return;
    }

    if (!agentOrchestrator) {
      addMessage('system', 'Error: Agent orchestrator not initialized');
      return;
    }

    try {
      // If there was a previous AI question, add it to history now
      if (currentResponseData && currentResponseData.displayText) {
        addMessage('assistant', currentResponseData.displayText);
        setCurrentResponseData(null);
      }
      
      // Show processing indicator
      setIsWaitingForAI(true);
      
      // If this is the initial feature description
      if (!featureDescription) {
        setFeatureDescription(input);
        
        // Update legacy chat session for compatibility
        if (chatSession) {
          chatSession.featureData.name = chatSession.extractFeatureName(input);
          chatSession.featureData.description = input;
        }
        
        // Generate session name if this is a new session
        if (!sessionName && sessionManager) {
          sessionName = sessionManager.generateSessionName(input);
        }

        addMessage('system', 'Starting interactive planning session...');
        
        // Prepare codebase context
        let codebaseContext = '';
        if (chatSession && chatSession.codebaseContent) {
          codebaseContext = chatSession.codebaseContent;
          console.log('📦 Codebase context length:', codebaseContext.length);
          console.log('📦 Codebase context preview:', codebaseContext.substring(0, 500) + '...');
        } else {
          console.log('⚠️  No codebase content found in chatSession');
          if (chatSession) {
            console.log('ChatSession properties:', Object.keys(chatSession));
          }
        }
        
        // Add repomix summary if available
        if (repomixSummary) {
          codebaseContext += `\n\nRepository Analysis:\n- Files processed: ${repomixSummary.fileCount.toLocaleString()}\n- Total lines: ${repomixSummary.totalLines.toLocaleString()}\n- Content size: ${repomixSummary.sizeKB} KB\n- Estimated tokens: ${repomixSummary.estimatedTokens.toLocaleString()}`;
          console.log('📊 Added repomix summary to context');
        }
        
        // Add AI analysis if available
        if (aiAnalysis) {
          codebaseContext += `\n\nInitial AI Analysis:\n${aiAnalysis}`;
          console.log('🤖 Added AI analysis to context');
        }
        
        console.log('📋 Final codebase context length:', codebaseContext.length);
        console.log('📋 Final context preview:', codebaseContext.substring(0, 1000) + '...');
        
        // Start planning with AgentOrchestrator
        const response = await agentOrchestrator.startPlanning(input, codebaseContext);
        
        // Clear waiting state
        setIsWaitingForAI(false);
        
        if (response.type === 'planning_question') {
          // Display the question with proper formatting
          const questionData = response.data;
          
          // Don't add to chat history yet - it will be added after user responds
          // Just set up the selector
          setCurrentResponseData({ parsedData: questionData, displayText: buildDisplayText(questionData) });
          setLastAIResponse(JSON.stringify(questionData));
          setInputMode('selector');
        }
      } else {
        // Handle subsequent responses
        const response = await agentOrchestrator.respondToQuestion(input);
        
        // Clear waiting state
        setIsWaitingForAI(false);
        
        if (response.type === 'planning_question') {
          // Continue with next question
          const questionData = response.data;
          
          // Don't add to chat history yet - it will be added after user responds
          // Just set up the selector
          setCurrentResponseData({ parsedData: questionData, displayText: buildDisplayText(questionData) });
          setLastAIResponse(JSON.stringify(questionData));
          setInputMode('selector');
        } else if (response.type === 'phase_transition') {
          // Ready for ADR generation
          addMessage('system', response.message);
          await generateADR();
        }
      }
    } catch (error) {
      setIsWaitingForAI(false);
      addMessage('system', `Error in planning: ${error.message}`);
      console.error('Planning error:', error);
    }
  };

  // Helper function to build display text from parsed data
  const buildDisplayText = (questionData) => {
    let displayText = '';
    
    if (questionData.header) {
      displayText += `# ${questionData.header}\n\n`;
    }
    
    if (questionData.bodyText) {
      displayText += questionData.bodyText;
    }
    
    if (questionData.optionText) {
      displayText += `\n\n---\n\n**${questionData.optionText}**`;
    }
    
    return displayText;
  };

  const generateADR = async () => {
    if (!agentOrchestrator) {
      addMessage('system', 'Error: Agent orchestrator not initialized');
      return;
    }

    try {
      setMode('adr_generation');
      addMessage('system', '📝 Generating Architecture Decision Record...');
      
      // Use AgentOrchestrator to generate ADR
      const adrResult = await agentOrchestrator.generateADR();
      
      if (adrResult.type === 'adr_generated') {
        const adr = adrResult.adr;
        
        // Update legacy chat session for compatibility
        if (chatSession) {
          chatSession.featureData.adr_content = adr.adrContent;
          chatSession.featureData.implementation_plan = adr.implementationPlan;
          chatSession.featureData.adr_title = adr.title;
          chatSession.featureData.adrFilename = chatSession.generateADRFilename(adr.title || chatSession.featureData.name);
        }
        
        // Display the generated ADR
        addMessage('assistant', adr.adrContent);
        
        // Save final session state
        if (sessionManager && sessionName && chatSession) {
          try {
            await sessionManager.saveSession(sessionName, chatSession.featureData, adrResult.conversationHistory);
          } catch (error) {
            addMessage('system', '⚠️  Warning: Failed to save final session data');
          }
        }

        addMessage('system', '✅ ADR generation completed! Type "exit" to finish.');
        setMode('completed');
      } else {
        throw new Error('Failed to generate ADR');
      }
    } catch (error) {
      addMessage('system', `Error generating ADR: ${error.message}`);
      console.error('ADR generation error:', error);
    }
  };

  // Handle keyboard shortcuts
  useInput((input, key) => {
    if (key.escape) {
      exit();
    }
  });

  if (isInitializing) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="blue">🤖 Initializing chat session...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      {/* Header */}
      <Box borderStyle="single" paddingX={1} marginBottom={1}>
        <Text color="blue" bold>
          📊 Codeplot - Feature Planning Chat
        </Text>
        <Text color="gray"> (ESC to exit)</Text>
      </Box>

      {/* Chat messages */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} ref={scrollRef}>
        {messages.map((message, index) => (
          <Box key={index} marginBottom={1}>
            <Box width={12}>
              <Text color={
                message.type === 'user' ? 'green' : 
                message.type === 'assistant' ? 'blue' : 
                'yellow'
              }>
                {message.type === 'user' ? '👤 You:' : 
                 message.type === 'assistant' ? '🤖 AI:' : 
                 '📋 System:'}
              </Text>
            </Box>
            <Box flexGrow={1}>
              {message.type === 'assistant' ? (
                <MarkdownText wrap="wrap">{message.content}</MarkdownText>
              ) : (
                <Text wrap="wrap">{message.content}</Text>
              )}
            </Box>
          </Box>
        ))}
        
        {isWaitingForAI && inputMode !== 'selector' && (
          <Box marginBottom={1}>
            <Box width={12}>
              <Text color="blue">🤖 AI:</Text>
            </Box>
            <Box flexGrow={1}>
              <Text color="gray">Thinking...</Text>
            </Box>
          </Box>
        )}
      </Box>

      {/* Selector for AI responses with options */}
      {inputMode === 'selector' && lastAIResponse && (
        <Box borderStyle="single" borderColor="yellow" marginBottom={1}>
          <AIResponse 
            content={lastAIResponse}
            parsedData={currentResponseData}
            onOptionSelect={handleOptionSelect}
            onContinue={handleContinueWithText}
          />
        </Box>
      )}

      {/* Input area */}
      {inputMode === 'text' && (
        <Box borderStyle="single" paddingX={1}>
          <Text color="gray">{'> '}</Text>
          <TextInput
            value={currentInput}
            onChange={setCurrentInput}
            onSubmit={handleSubmit}
            placeholder={
              mode === 'completed' ? 'Type "review", "modify", or "exit"' :
              mode === 'planning' ? 'Your response (or "done" to finish)' :
              'Type your message...'
            }
          />
        </Box>
      )}
    </Box>
  );
};

export default ChatView;
