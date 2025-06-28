import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const DOTS_FRAMES = ['⠋', '⠙', '⠚', '⠞', '⠖', '⠦', '⠴', '⠲', '⠳', '⠓'];
const CLOCK_FRAMES = ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'];

const SPINNER_TYPES = {
  dots: SPINNER_FRAMES,
  dots2: DOTS_FRAMES,
  clock: CLOCK_FRAMES,
};

export const Spinner = ({ 
  text = 'Loading...', 
  type = 'dots', 
  color = 'blue',
  interval = 80 
}) => {
  const [frame, setFrame] = useState(0);
  const frames = SPINNER_TYPES[type] || SPINNER_TYPES.dots;

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prevFrame => (prevFrame + 1) % frames.length);
    }, interval);

    return () => clearInterval(timer);
  }, [frames.length, interval]);

  return (
    <Text color={color}>
      {frames[frame]} {text}
    </Text>
  );
};

export const ThinkingSpinner = ({ text = 'Thinking...' }) => (
  <Spinner text={text} type="dots" color="gray" />
);

export const LoadingSpinner = ({ text = 'Loading...' }) => (
  <Spinner text={text} type="dots2" color="blue" />
);

export const ProcessingSpinner = ({ text = 'Processing...' }) => (
  <Spinner text={text} type="clock" color="yellow" interval={100} />
);

export default Spinner;
