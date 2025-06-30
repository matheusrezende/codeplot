import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ParsedOption } from '../utils/response-parser';

interface OptionSelectorProps {
  options: ParsedOption[];
  onSelect: (option: ParsedOption) => void;
  onCancel: () => void;
}

export const OptionSelector: React.FC<OptionSelectorProps> = ({ options, onSelect, onCancel }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow || (key.tab && key.shift)) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (key.downArrow || key.tab) {
      setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      onSelect(options[selectedIndex]);
    } else if (key.escape) {
      onCancel();
    } else if (input >= '1' && input <= '9') {
      const optionIndex = parseInt(input, 10) - 1;
      if (optionIndex >= 0 && optionIndex < options.length) {
        onSelect(options[optionIndex]);
      }
    }
  });

  return (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          💡 Select an option:
        </Text>
      </Box>

      {options.map((option, index) => (
        <Box key={option.number}>
          <Box
            borderStyle={index === selectedIndex ? 'double' : 'single'}
            borderColor={
              option.isRecommended && index === selectedIndex
                ? 'yellow'
                : index === selectedIndex
                  ? 'cyan'
                  : option.isRecommended
                    ? 'yellow'
                    : 'gray'
            }
            paddingX={2}
            paddingY={0}
            minWidth={60}
          >
            <Box flexDirection="column">
              <Box>
                <Text bold color={index === selectedIndex ? 'cyan' : 'white'}>
                  {option.number}. {option.title}
                </Text>
                {option.isRecommended && (
                  <Text bold color="black" backgroundColor="yellow">
                    {' '}
                    ⭐ RECOMMENDED{' '}
                  </Text>
                )}
              </Box>
              {option.description && option.description.trim() && (
                <Box marginLeft={3} marginTop={0}>
                  <Text color={index === selectedIndex ? 'white' : 'gray'} dimColor>
                    {option.description.trim().split('\n')[0]}
                    {option.description.trim().split('\n').length > 1 && '...'}
                  </Text>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
