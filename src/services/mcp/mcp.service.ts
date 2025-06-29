import { inject, singleton } from 'tsyringe';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { IMcpService } from './mcp.interface';
import type { ILoggerService } from '../logger/logger.interface';
import type { IConfigService } from '../config/config.interface';
import { McpTool } from '../../common/mcp-tool';
import { McpServer } from '../../schemas/mcp-config.schema';

@singleton()
export class McpService implements IMcpService {
  private clients: Map<string, Client> = new Map();
  private tools: McpTool[] = [];

  constructor(
    @inject('ILoggerService') private readonly logger: ILoggerService,
    @inject('IConfigService') private readonly configService: IConfigService
  ) {}

  public async connect(): Promise<void> {
    const config = await this.configService.loadConfig();
    const enabledServers = config.servers.filter(server => server.enabled);

    this.logger.info(`Connecting to ${enabledServers.length} enabled MCP servers...`);

    for (const server of enabledServers) {
      await this.connectToServer(server);
    }
  }

  public async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from all MCP servers...');

    const disconnectPromises = Array.from(this.clients.entries()).map(async ([name, client]) => {
      try {
        await client.close();
        this.logger.info(`Disconnected from server: ${name}`);
      } catch (error) {
        this.logger.error(`Error disconnecting from server ${name}:`, error);
      }
    });

    await Promise.allSettled(disconnectPromises);
    this.clients.clear();
    this.tools = [];
  }

  public getTools(): McpTool[] {
    return this.tools;
  }

  public async callTool(toolName: string, args: unknown): Promise<unknown> {
    const tool = this.tools.find(t => t.toolName === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const client = this.clients.get(tool.serverName);
    if (!client) {
      throw new Error(`Client not found for server: ${tool.serverName}`);
    }

    try {
      const result = await client.callTool({
        name: toolName,
        arguments: (args as Record<string, unknown>) || {},
      });
      return result.content;
    } catch (error) {
      this.logger.error(`Error calling tool ${toolName}:`, error);
      throw error;
    }
  }

  private async connectToServer(server: McpServer): Promise<void> {
    try {
      this.logger.info(`Connecting to MCP server: ${server.name}`);

      const transport = new StdioClientTransport({
        command: server.command,
        args: server.args || [],
      });

      const client = new Client(
        {
          name: 'codeplot',
          version: '3.1.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      await client.connect(transport);
      this.clients.set(server.name, client);

      this.logger.info(`Successfully connected to MCP server: ${server.name}`);

      // Discover tools from this server
      await this.discoverTools(server.name, client);
    } catch (error) {
      this.logger.error(`Failed to connect to MCP server ${server.name}:`, error);
      throw error;
    }
  }

  private async discoverTools(serverName: string, client: Client): Promise<void> {
    try {
      const result = await client.listTools();

      const discoveredTools = result.tools.map((tool: Tool) => ({
        serverName,
        toolName: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      this.tools.push(...discoveredTools);
      this.logger.info(`Discovered ${discoveredTools.length} tools from server: ${serverName}`);
    } catch (error) {
      this.logger.error(`Error discovering tools from ${serverName}:`, error);
    }
  }
}
