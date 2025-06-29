import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

const WorkflowSelector = ({ onSelect }) => {
  const items = [
    {
      label: 'An Architecture Decision Record (for developers)',
      value: 'adr',
    },
    {
      label: 'A Product Requirements Document (for product managers)',
      value: 'prd',
    },
  ];

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>What would you like to create?</Text>
      </Box>
      <SelectInput items={items} onSelect={onSelect} />
    </Box>
  );
};

export default WorkflowSelector;
