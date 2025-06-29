import { McpTool } from '../../common/mcp-tool';

export interface IMcpService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getTools(): McpTool[];
  callTool(toolName: string, args: unknown): Promise<unknown>;
}
