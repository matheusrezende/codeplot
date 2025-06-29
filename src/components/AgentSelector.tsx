import React from 'react';
import SelectInput from 'ink-select-input';
import { Box, Text } from 'ink';

interface AgentSelectorProps {
  onSelect: (agent: 'dev' | 'pm') => void;
}

interface AgentItem {
  label: string;
  value: 'dev' | 'pm';
}

const items: AgentItem[] = [
  { label: 'Plan a feature implementation (Developer Agent)', value: 'dev' },
  { label: 'Create a Product Requirements Document (PM Agent)', value: 'pm' },
];

export const AgentSelector: React.FC<AgentSelectorProps> = ({ onSelect }) => {
  const handleSelect = (item: AgentItem) => {
    onSelect(item.value);
  };

  return (
    <Box flexDirection="column">
      <Text>What would you like to do?</Text>
      <SelectInput items={items} onSelect={handleSelect} />
    </Box>
  );
};
