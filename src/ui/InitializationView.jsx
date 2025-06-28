import React from 'react';
import { Box, Text } from 'ink';

const InitializationView = ({ statusMessage, repomixSummary, aiAnalysis, isStreamingAnalysis, streamingAnalysis }) => {
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="single" padding={1}>
        <Text color="blue" bold>📊 Codeplot</Text>
        <Text color="gray"> - AI-powered feature planning</Text>
      </Box>

      {/* Status Message */}
      <Box padding={1}>
        <Text color="yellow">🔄 {statusMessage}</Text>
      </Box>

      {/* Repomix Summary */}
      {repomixSummary && (
        <Box flexDirection="column" marginY={1}>
          <Box borderStyle="single" borderColor="cyan" paddingX={1}>
            <Text color="cyan" bold>📦 Repomix Summary</Text>
          </Box>
          <Box paddingX={1} paddingY={1}>
            <Box flexDirection="column">
              <Text color="gray">Files processed: <Text color="white">{repomixSummary.fileCount.toLocaleString()}</Text></Text>
              <Text color="gray">Total lines: <Text color="white">{repomixSummary.totalLines.toLocaleString()}</Text></Text>
              <Text color="gray">Content size: <Text color="white">{repomixSummary.sizeKB} KB</Text></Text>
              <Text color="gray">Estimated tokens: <Text color="white">{repomixSummary.estimatedTokens.toLocaleString()}</Text></Text>
              
              {repomixSummary.sampleFiles.length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                  <Text color="gray">Sample files:</Text>
                  {repomixSummary.sampleFiles.map((file, index) => (
                    <Text key={index} color="gray">  • <Text color="white">{file}</Text></Text>
                  ))}
                  {repomixSummary.hasMoreFiles && (
                    <Text color="gray">  ... and <Text color="white">{repomixSummary.remainingCount}</Text> more files</Text>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* AI Analysis */}
      {(aiAnalysis || isStreamingAnalysis) && (
        <Box flexDirection="column" marginY={1}>
          <Box borderStyle="single" borderColor="blue" paddingX={1}>
            <Text color="blue" bold>🤖 AI Analysis</Text>
          </Box>
          <Box paddingX={1} paddingY={1}>
            {isStreamingAnalysis ? (
              <Box flexDirection="column">
                <Text wrap="wrap">{streamingAnalysis}</Text>
                {streamingAnalysis && <Text color="yellow">▋</Text>}
              </Box>
            ) : (
              <Text wrap="wrap">{aiAnalysis}</Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default InitializationView;
