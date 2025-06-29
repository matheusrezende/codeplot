export interface McpServer {
  name: string;
  command: string;
  args?: string[];
  enabled: boolean;
}

export interface McpConfig {
  servers: McpServer[];
}

// Support for the original configuration file format
export interface McpServerFileFormat {
  command: string;
  args?: string[];
  enabled?: boolean; // Optional, defaults to true
}

export interface McpConfigFileFormat {
  // Support both formats
  servers?: McpServer[]; // New format
  mcpServers?: Record<string, McpServerFileFormat>; // Original format
}
