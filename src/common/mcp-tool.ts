export interface McpTool {
  serverName: string;
  toolName: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}
