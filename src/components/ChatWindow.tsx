import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import { IAgentService } from '../services/agent/agent.interface';
import { OptionSelector } from './OptionSelector';
import { ParsedOption } from '../utils/response-parser';
import { LoadingIndicator } from './LoadingIndicator';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatWindowProps {
  agentService: IAgentService;
  onExit: () => void;
}

interface Message {
  sender: 'user' | 'agent' | 'system' | 'thought';
  content: string;
}

const senderDisplay = {
  user: { emoji: '👤', color: '#00FF7F', name: 'You' },
  agent: { emoji: '🤖', color: '#00BFFF', name: 'Agent' },
  system: { emoji: '⚙️', color: '#FFD700', name: 'System' },
  thought: { emoji: '🤔', color: '#FFA500', name: 'Thinking' },
};

export function ChatWindow({ agentService, onExit }: ChatWindowProps): React.ReactElement {
  const { exit } = useApp();
  const [history, setHistory] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<ParsedOption[]>([]);
  const [isWaitingForHuman, setIsWaitingForHuman] = useState(false);
  const [humanInput, setHumanInput] = useState('');

  const threadId = useMemo(() => Math.random().toString(36).substring(7), []);

  useEffect(() => {
    setHistory([
      {
        sender: 'system',
        content:
          'Welcome to CodePlot! Your AI-powered development assistant. How can I help you today?',
      },
    ]);
  }, []);

  const [optionsQuestion, setOptionsQuestion] = useState('');
  const processStream = async (
    stream: AsyncGenerator<{ type: string; content: string }>
  ): Promise<void> => {
    let currentToolCall = '';

    for await (const chunk of stream) {
      if (chunk.type === 'thinking') {
        setStatusText('Thinking...');
      } else if (chunk.type === 'tool_call') {
        currentToolCall = chunk.content;
        setStatusText(`Using tool: ${currentToolCall}...`);
      } else if (chunk.type === 'tool_end') {
        setStatusText('Thinking...');
      } else if (chunk.type === 'agent') {
        setStatusText('');
        currentToolCall = '';
        setIsLoading(true);

        const words = chunk.content.split(' ');
        for (const word of words) {
          setHistory(prev => {
            const newHistory = [...prev];
            const lastMessage = newHistory[newHistory.length - 1];

            if (lastMessage && lastMessage.sender === 'agent') {
              lastMessage.content += (lastMessage.content ? ' ' : '') + word;
            } else {
              newHistory.push({ sender: 'agent', content: word });
            }
            return newHistory;
          });
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } else if (chunk.type === 'human_input_required') {
        setHistory(prev => [...prev, { sender: 'agent', content: chunk.content }]);
        setOptionsQuestion(chunk.content);
        setIsWaitingForHuman(true);
        setIsLoading(false);
        return;
      } else if (chunk.type === 'user_choice_required') {
        const { question, options } = JSON.parse(chunk.content);
        const parsedOptions: ParsedOption[] = options.map((opt: any, index: number) => ({
          ...opt,
          number: index + 1,
        }));

        setOptionsQuestion(question);
        setCurrentOptions(parsedOptions);
        setShowOptions(true);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(false);
    setStatusText('');
  };

  const [isFirstMessage, setIsFirstMessage] = useState(true);

  const handleSumbit = async (): Promise<void> => {
    if (!input) return;
    if (input.toLowerCase() === 'exit') {
      onExit();
      exit();
      return;
    }

    const userMessage: Message = { sender: 'user', content: input };
    let currentHistory: Message[] = [...history, userMessage];

    if (isFirstMessage) {
      currentHistory = [...currentHistory, { sender: 'system', content: 'Analyzing codebase...' }];
      setIsFirstMessage(false);
    }

    setHistory(currentHistory);
    setInput('');
    setIsLoading(true);
    setShowOptions(false);
    setStatusText('Sending request...');

    setTimeout(async () => {
      const stream = agentService.stream(input, threadId);
      await processStream(stream);
    }, 0);
  };

  const handleOptionSelect = async (option: ParsedOption): Promise<void> => {
    const optionText = option.title;
    setShowOptions(false);
    setOptionsQuestion('');

    const userMessage: Message = { sender: 'user', content: optionText };
    setHistory(prev => [...prev, userMessage]);
    setIsLoading(true);

    setTimeout(async () => {
      const stream = agentService.stream(optionText, threadId);
      await processStream(stream);
    }, 0);
  };

  const handleOptionCancel = (): void => {
    setShowOptions(false);
  };

  const handleHumanInputSubmit = async (): Promise<void> => {
    if (!humanInput) return;

    const userMessage: Message = { sender: 'user', content: humanInput };
    setHistory(prev => [...prev, userMessage]);
    setHumanInput('');
    setIsLoading(true);
    setIsWaitingForHuman(false);

    setTimeout(async () => {
      const stream = agentService.stream(humanInput, threadId);
      await processStream(stream);
    }, 0);
  };

  const groupedHistory = history.reduce<Array<{ sender: Message['sender']; messages: Message[] }>>(
    (acc, message) => {
      const lastGroup = acc[acc.length - 1];
      if (lastGroup && lastGroup.sender === message.sender) {
        lastGroup.messages.push(message);
      } else {
        acc.push({ sender: message.sender, messages: [message] });
      }
      return acc;
    },
    []
  );

  return (
    <Box flexDirection="column" flexGrow={1} padding={1}>
      <Gradient name="rainbow">
        <BigText text="CodePlot" align="center" font="block" />
      </Gradient>
      <Box flexDirection="column" flexGrow={1} borderStyle="round" padding={1}>
        {groupedHistory.map((group, groupIndex) => (
          <Box key={groupIndex} flexDirection="column" marginBottom={1}>
            <Text bold color={senderDisplay[group.sender].color}>
              {senderDisplay[group.sender].emoji} {senderDisplay[group.sender].name}
            </Text>
            {group.messages.map((message, messageIndex) => (
              <Box key={messageIndex} marginLeft={3}>
                <MarkdownRenderer content={message.content} />
              </Box>
            ))}
          </Box>
        ))}
        {isLoading && <LoadingIndicator text={statusText} />}
      </Box>

      {isWaitingForHuman ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="yellow">
            {optionsQuestion}
          </Text>
          <Box borderStyle="single" paddingX={1}>
            <Text>› </Text>
            <TextInput
              value={humanInput}
              onChange={setHumanInput}
              onSubmit={handleHumanInputSubmit}
            />
          </Box>
        </Box>
      ) : (
        <>
          {showOptions && currentOptions.length > 0 && (
            <Box flexDirection="column" marginY={1}>
              <Box marginBottom={1}>
                <Text bold color="yellow">
                  {optionsQuestion}
                </Text>
              </Box>
              <OptionSelector
                options={currentOptions}
                onSelect={handleOptionSelect}
                onCancel={handleOptionCancel}
              />
            </Box>
          )}
          <Box marginTop={1} borderStyle="single" paddingX={1}>
            <Text>› </Text>
            <TextInput value={input} onChange={setInput} onSubmit={handleSumbit} />
          </Box>
        </>
      )}
      <Box marginTop={1} justifyContent="center">
        <Box flexDirection="column" alignItems="center">
          {showOptions && (
            <Box marginBottom={1}>
              <Text color="gray" dimColor>
                ↑/↓ Navigate • Enter Select • 1-{currentOptions.length} Quick select • Esc Cancel •
                Type your own message
              </Text>
            </Box>
          )}
          <Text color="gray" dimColor>
            Type "exit" to quit
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
