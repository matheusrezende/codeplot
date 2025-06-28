import React from 'react';
import { Text } from 'ink';

const MarkdownText = ({ children, wrap = true, ...props }) => {
  // Simple markdown-to-terminal conversion
  const renderMarkdown = (text) => {
    if (typeof text !== 'string') return text;
    
    let rendered = text
      // Headers - convert ### Header to bold Header
      .replace(/^#{1,6}\s*(.+)$/gm, (match, content) => `\n${content.toUpperCase()}\n${'='.repeat(content.length)}\n`)
      // Bold text
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove ** markers for now, Ink doesn't support bold in Text
      // Italic text  
      .replace(/\*([^*]+)\*/g, '$1') // Remove * markers
      // Inline code
      .replace(/`([^`]+)`/g, '[$1]')
      // Code blocks - just indent them
      .replace(/```[\s\S]*?```/g, (match) => {
        const code = match.replace(/```.*?\n?/g, '');
        return code.split('\n').map(line => `    ${line}`).join('\n');
      })
      // Numbered lists - keep as is
      .replace(/^(\d+)\. /gm, '$1. ')
      // Bullet points
      .replace(/^[-*+] /gm, '• ')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Blockquotes
      .replace(/^> /gm, '│ ');
    
    return rendered;
  };

  const processedContent = renderMarkdown(children);
  
  return <Text wrap={wrap} {...props}>{processedContent}</Text>;
};

export default MarkdownText;
