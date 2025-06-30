import React from 'react';
import { Box, Text } from 'ink';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps): React.ReactElement {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let isCodeBlock = false;
  let codeBlockContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks
    if (line.startsWith('```')) {
      if (!isCodeBlock) {
        isCodeBlock = true;
      } else {
        isCodeBlock = false;
        elements.push(
          <Box
            key={`code-block-${i}`}
            borderStyle="round"
            borderColor="gray"
            padding={1}
            flexDirection="column"
          >
            {codeBlockContent
              .trim()
              .split('\n')
              .map((codeLine, j) => (
                <Text key={j} color="cyan">
                  {codeLine}
                </Text>
              ))}
          </Box>
        );
        codeBlockContent = '';
      }
      continue;
    }

    if (isCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line)) {
      elements.push(
        <Text key={i} color="gray">
          ─────────────────────────────────
        </Text>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <Box key={i} paddingLeft={2}>
          <Text color="green">❝ {processInlineMarkdown(line.substring(2), i)}</Text>
        </Box>
      );
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const [, hashes, headingText] = headingMatch;
      const headingSize = hashes.length;

      const colorMap = ['magenta', 'blueBright', 'cyan', 'white', 'gray', 'gray'];
      elements.push(
        <Text key={i} bold color={colorMap[headingSize - 1]}>
          {'\n'}
          {headingText}
          {'\n'}
        </Text>
      );
      continue;
    }

    // Ordered lists
    const orderedMatch = line.match(/^(\s*)\d+\. (.*)$/);
    if (orderedMatch) {
      const [_, indent, item] = orderedMatch;
      elements.push(
        <Box key={i} paddingLeft={indent.length + 2}>
          <Text>• {processInlineMarkdown(item, i)}</Text>
        </Box>
      );
      continue;
    }

    // Unordered lists
    const unorderedMatch = line.match(/^(\s*)[-+*] (.*)$/);
    if (unorderedMatch) {
      const [_, indent, item] = unorderedMatch;
      elements.push(
        <Box key={i} paddingLeft={indent.length + 2}>
          <Text>• {processInlineMarkdown(item, i)}</Text>
        </Box>
      );
      continue;
    }

    // Empty line → add spacing
    if (line.trim() === '') {
      elements.push(<Text key={i}>{'\n'}</Text>);
      continue;
    }

    // Regular paragraph
    elements.push(<Text key={i}>{processInlineMarkdown(line, i)}</Text>);
  }

  return <Box flexDirection="column">{elements}</Box>;
}

// Markdown inline formatting
function processInlineMarkdown(text: string, keyOffset = 0): (string | React.ReactElement)[] {
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)]\(([^)]+)\))/g;
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[0].startsWith('**')) {
      parts.push(
        <Text key={`${keyOffset}-${match.index}`} bold>
          {match[0].slice(2, -2)}
        </Text>
      );
    } else if (match[0].startsWith('*')) {
      parts.push(
        <Text key={`${keyOffset}-${match.index}`} italic>
          {match[0].slice(1, -1)}
        </Text>
      );
    } else if (match[0].startsWith('`')) {
      parts.push(
        <Text key={`${keyOffset}-${match.index}`} backgroundColor="gray" color="black">
          {' ' + match[0].slice(1, -1) + ' '}
        </Text>
      );
    } else if (match[2] && match[3]) {
      // [text](url)
      parts.push(
        <Text key={`${keyOffset}-${match.index}`}>
          {match[2]} (
          <Text underline color="blueBright">
            {match[3]}
          </Text>
          )
        </Text>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.map((part, i) =>
    typeof part === 'string' ? <Text key={`${keyOffset}-p-${i}`}>{part}</Text> : part
  );
}
