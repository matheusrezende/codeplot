import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import MarkdownText from './MarkdownText.jsx';
import { SimpleStreamProcessor } from '../utils/StreamingJsonParser.js';

const AIResponse = ({ content, onOptionSelect, onContinue, parsedData = null }) => {
  const [hasOptions, setHasOptions] = useState(false);
  const [options, setOptions] = useState([]);
  const [responseText, setResponseText] = useState('');
  const [showSelector, setShowSelector] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    // If we have pre-parsed data from streaming, use that
    if (parsedData && parsedData.parsedData) {
      const parser = new SimpleStreamProcessor();
      parser.parsedContent = parsedData.parsedData;
      
      setResponseText(parsedData.displayText);
      setOptions(parser.getOptions());
      setHasOptions(parser.hasOptions());
      setShowSelector(parser.hasOptions());
    } else {
      parseResponse(content);
    }
  }, [content, parsedData]);

  const parseResponse = (text) => {
    // Use SimpleStreamProcessor to parse semantic markdown
    const processor = new SimpleStreamProcessor();
    const result = processor.processChunk(text);
    
    // Set the display text
    setResponseText(result.displayText || text);
    
    // Set options if any
    const processedOptions = processor.getOptions();
    setOptions(processedOptions);
    setHasOptions(processedOptions.length > 0);
    setShowSelector(processedOptions.length > 0);
  };

  const handleSelect = (item) => {
    if (item.value === 'custom') {
      setShowSelector(false);
      onContinue(); // Switch back to text input mode
    } else {
      // Use the cleaned title for better option selection text
      const selectionText = item.title || item.description;
      onOptionSelect(selectionText, item.value);
    }
  };

  // Handle keyboard input for navigation and selection
  useInput((input, key) => {
    if (!showSelector || options.length === 0) return;

    if (key.upArrow) {
      setSelectedIndex(prev => prev > 0 ? prev - 1 : options.length - 1);
    } else if (key.downArrow) {
      setSelectedIndex(prev => prev < options.length - 1 ? prev + 1 : 0);
    } else if (key.return) {
      handleSelect(options[selectedIndex]);
    } else if (input >= '1' && input <= '9') {
      const num = parseInt(input);
      if (num <= options.length - 1) { // -1 because last option is "custom"
        const selectedOption = options.find(opt => parseInt(opt.value) === num);
        if (selectedOption) {
          handleSelect(selectedOption);
        }
      }
    }
  });

  return (
    <Box flexDirection="column">
      {/* AI Response Text */}
      {responseText && (
        <Box borderStyle="single" borderColor="gray" padding={1} marginBottom={1}>
          <MarkdownText wrap="wrap">{responseText}</MarkdownText>
        </Box>
      )}

      {/* Options List */}
      {hasOptions && showSelector && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="yellow">🤖 AI Recommendations (use ↑↓ arrows or type number + Enter):</Text>
          </Box>
          
          {/* Custom Options List */}
          <Box flexDirection="column">
            {options.map((option, index) => {
              const isSelected = index === selectedIndex;
              const isRecommended = index === 0 && option.value !== 'custom';
              const isCustom = option.value === 'custom';
              
              return (
                <Box 
                  key={index}
                  minHeight={3}
                  width="100%"
                  borderStyle={isSelected ? 'single' : undefined}
                  borderColor={isSelected ? 'cyan' : undefined}
                  backgroundColor={isRecommended ? 'blue' : undefined}
                  paddingX={1}
                  marginBottom={index < options.length - 1 ? 1 : 0}
                >
                  <Box width={4}>
                    <Text color={isSelected ? 'cyan' : 'gray'}>
                      {isSelected ? '▶ ' : '  '}
                      {!isCustom ? option.value + '.' : '💬'}
                    </Text>
                  </Box>
                  <Box flexGrow={1}>
                    <Text 
                      color={
                        isRecommended ? 'white' :
                        isSelected ? 'cyan' : 
                        isCustom ? 'yellow' : 'white'
                      }
                      bold={isRecommended}
                      wrap="wrap"
                    >
                      {isRecommended && '⭐ RECOMMENDED: '}
                      {option.title || option.description || option.label}
                    </Text>
                    {option.description && option.description !== option.title && (
                      <Text 
                        color="gray" 
                        dimColor 
                        wrap="wrap"
                        marginTop={1}
                      >
                        {option.description}
                      </Text>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
          
          <Box marginTop={1}>
            <Text color="gray" dimColor>
              💡 Tip: Press 1-{options.length - 1} + Enter for quick selection, ↑↓ + Enter, or ESC to type custom response
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default AIResponse;
