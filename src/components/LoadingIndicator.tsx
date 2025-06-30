import { setInterval, clearInterval } from 'timers';
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

const brailleFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface LoadingIndicatorProps {
  text: string;
}

export function LoadingIndicator({ text }: LoadingIndicatorProps): React.ReactElement {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prevFrame => (prevFrame + 1) % brailleFrames.length);
    }, 80);

    return (): void => {
      clearInterval(timer);
    };
  }, []);

  return (
    <Box>
      <Text color="yellow">{brailleFrames[frame]}</Text>
      <Box marginLeft={1}>
        <Text>{text}</Text>
      </Box>
    </Box>
  );
}
