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
      // Log the tool call details for debugging
      this.logger.debug(`Calling tool ${toolName} with args:`, args);

      // Ensure args is a proper object
      let toolArgs: Record<string, unknown> = {};
      if (typeof args === 'string') {
        try {
          toolArgs = JSON.parse(args);
        } catch {
          // Try to parse natural language patterns for common cases
          toolArgs = this.parseNaturalLanguageArgs(args, toolName);
        }
      } else if (args && typeof args === 'object') {
        toolArgs = args as Record<string, unknown>;
      }

      this.logger.debug(`Processed tool args:`, toolArgs);

      const result = await client.callTool({
        name: toolName,
        arguments: toolArgs,
      });
      return result.content;
    } catch (error) {
      this.logger.error(`Error calling tool ${toolName} with args ${JSON.stringify(args)}:`, error);
      if (error && typeof error === 'object' && 'message' in error) {
        this.logger.error(`Error details: ${(error as any).message}`);
      }
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

      // Log tool schemas for debugging
      discoveredTools.forEach(tool => {
        this.logger.debug(
          `Tool ${tool.toolName} schema:`,
          JSON.stringify(tool.inputSchema, null, 2)
        );
      });
    } catch (error) {
      this.logger.error(`Error discovering tools from ${serverName}:`, error);
    }
  }

  private parseNaturalLanguageArgs(argsString: string, toolName: string): Record<string, unknown> {
    this.logger.debug(`Parsing natural language args for ${toolName}: "${argsString}"`);

    // Handle common patterns for specific tools
    if (toolName === 'pack_codebase') {
      // Look for path/directory patterns
      const pathMatch = argsString.match(/(?:path|directory):\s*"([^"]+)"/);
      if (pathMatch) {
        return { directory: pathMatch[1] };
      }
      // If it's just a path without quotes
      const directPathMatch = argsString.match(/(?:path|directory):\s*([^\s,]+)/);
      if (directPathMatch) {
        return { directory: directPathMatch[1] };
      }
      // If it's just a plain directory path
      if (argsString.startsWith('/') || argsString.includes('Users')) {
        return { directory: argsString.trim() };
      }
      // Default to current working directory if no path specified
      return { directory: process.cwd() };
    }

    if (toolName === 'grep_repomix_output') {
      // Try to extract outputId and pattern from natural language
      const outputIdMatch = argsString.match(/(?:outputId|output):\s*"([^"]+)"/);
      const patternMatch = argsString.match(/(?:pattern|search):\s*"([^"]+)"/);

      const result: Record<string, unknown> = {};
      if (outputIdMatch) result.outputId = outputIdMatch[1];
      if (patternMatch) result.pattern = patternMatch[1];

      // If we have some parameters but not all, return what we have
      if (Object.keys(result).length > 0) {
        return result;
      }

      // If it looks like a search pattern without explicit structure
      if (argsString && !argsString.includes(':')) {
        return { pattern: argsString.trim() };
      }
    }

    if (toolName === 'file_system_read_directory' || toolName === 'file_system_read_file') {
      // Look for path patterns
      const pathMatch = argsString.match(/path:\s*"([^"]+)"/);
      if (pathMatch) {
        return { path: pathMatch[1] };
      }
      // If it's just a path without quotes
      const directPathMatch = argsString.match(/path:\s*([^\s,]+)/);
      if (directPathMatch) {
        return { path: directPathMatch[1] };
      }
      // If it's just a plain path
      if (argsString.startsWith('/') || argsString.includes('Users')) {
        return { path: argsString.trim() };
      }
      // Default to current working directory
      return { path: process.cwd() };
    }

    // Generic parameter extraction for key:value patterns
    const genericMatch = argsString.match(/(\w+):\s*"([^"]+)"/g);
    if (genericMatch) {
      const result: Record<string, unknown> = {};
      genericMatch.forEach(match => {
        const [, key, value] = match.match(/(\w+):\s*"([^"]+)"/) || [];
        if (key && value) {
          result[key] = value;
        }
      });
      if (Object.keys(result).length > 0) {
        return result;
      }
    }

    // Fallback: treat as input parameter
    return { input: argsString };
  }
}
