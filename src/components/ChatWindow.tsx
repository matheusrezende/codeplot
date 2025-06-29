import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import { IAgentService } from '../services/agent/agent.interface';

interface ChatWindowProps {
  agentService: IAgentService;
  onExit: () => void;
}

interface Message {
  sender: 'user' | 'agent' | 'system';
  content: string;
}

const senderDisplay = {
  user: { emoji: '👤', color: '#00FF7F', name: 'You' },
  agent: { emoji: '🤖', color: '#00BFFF', name: 'Agent' },
  system: { emoji: '⚙️', color: '#FFD700', name: 'System' },
};

const LoadingIndicator = () => {
  const [dots, setDots] = useState('');
  useEffect(() => {
    let dotCount = 0;
    const animate = () => {
      dotCount = (dotCount + 1) % 4;
      setDots('.'.repeat(dotCount));
      setTimeout(animate, 300);
    };
    const timeoutId = setTimeout(animate, 300);
    return () => clearTimeout(timeoutId);
  }, []);
  return <Text>Thinking{dots}</Text>;
};

export function ChatWindow({ agentService, onExit }: ChatWindowProps) {
  const { exit } = useApp();
  const [history, setHistory] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setHistory([
      {
        sender: 'system',
        content:
          'Welcome to CodePlot! Your AI-powered development assistant. How can I help you today?',
      },
    ]);
  }, []);

  const handleSumbit = async () => {
    if (!input) return;
    if (input.toLowerCase() === 'exit') {
      onExit();
      exit();
      return;
    }

    const userMessage: Message = { sender: 'user', content: input };
    setHistory(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const stream = agentService.stream(input);
    let fullResponse = '';
    setHistory(prev => [...prev, { sender: 'agent', content: fullResponse }]);

    for await (const chunk of stream) {
      if (chunk.type === 'agent') {
        fullResponse += chunk.content;
        setHistory(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = {
            ...newHistory[newHistory.length - 1],
            content: fullResponse,
          };
          return newHistory;
        });
      }
    }
    setIsLoading(false);
  };

  return (
    <Box flexDirection="column" flexGrow={1} padding={1}>
      <Gradient name="rainbow">
        <BigText text="CodePlot" align="center" font="block" />
      </Gradient>
      <Box flexDirection="column" flexGrow={1} borderStyle="round" padding={1}>
        {history.map((message, index) => (
          <Box key={index} flexDirection="column" marginBottom={1}>
            <Text bold color={senderDisplay[message.sender].color}>
              {senderDisplay[message.sender].emoji} {senderDisplay[message.sender].name}
            </Text>
            <Box marginLeft={3}>
              <Text>{message.content}</Text>
            </Box>
          </Box>
        ))}
        {isLoading && (
          <Box marginLeft={3}>
            <Text color="gray">
              <LoadingIndicator />
            </Text>
          </Box>
        )}
      </Box>
      <Box marginTop={1} borderStyle="single" paddingX={1}>
        <Text>› </Text>
        <TextInput value={input} onChange={setInput} onSubmit={handleSumbit} />
      </Box>
      <Box marginTop={1} justifyContent="center">
        <Text color="gray" dimColor>
          Type "exit" to quit
        </Text>
      </Box>
    </Box>
  );
}
