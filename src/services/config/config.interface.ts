import { McpConfig } from '../../schemas/mcp-config.schema';

export interface IConfigService {
  loadConfig(): Promise<McpConfig>;
  getMcpConfig(): McpConfig;
}
