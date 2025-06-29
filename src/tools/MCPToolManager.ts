import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { DynamicTool } from '@langchain/core/tools';
import { logger } from '../utils/logger.js';
import { MCPConfigManager } from '../config/MCPConfigManager.js';
import { MCPClient } from '../clients/MCPClient.js';
import { MCPServerConfig, MCPToolConfig } from '../types/mcp.js';

@injectable()
export class MCPToolManager {
  private mcpConfigManager: MCPConfigManager;
  private tools: DynamicTool[] = [];
  private toolConfigs: MCPToolConfig[] = [];

  constructor(@inject(MCPConfigManager) mcpConfigManager: MCPConfigManager) {
    this.mcpConfigManager = mcpConfigManager;
  }

  /**
   * Initialize and create all available MCP tools
   */
  async initializeTools(): Promise<DynamicTool[]> {
    try {
      logger.debug('MCPToolManager: Initializing MCP tools');

      const servers = await this.mcpConfigManager.loadActiveServers();

      if (servers.length === 0) {
        logger.info('MCPToolManager: No active MCP servers found');
        return [];
      }

      this.tools = [];
      this.toolConfigs = [];

      for (const server of servers) {
        await this.createToolsForServer(server);
      }

      logger.info('MCPToolManager: Successfully initialized MCP tools', {
        serverCount: servers.length,
        toolCount: this.tools.length,
        toolNames: this.tools.map(t => t.name),
      });

      return this.tools;
    } catch (error) {
      logger.error('MCPToolManager: Failed to initialize tools', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Create tools for a specific MCP server
   */
  private async createToolsForServer(server: MCPServerConfig): Promise<void> {
    try {
      logger.debug('MCPToolManager: Creating tools for server', { serverId: server.id });

      // Create search tool
      const searchTool = this.createSearchTool(server);
      this.tools.push(searchTool);

      this.toolConfigs.push({
        serverId: server.id,
        serverConfig: server,
        toolName: searchTool.name,
        description: `Search ${server.description}`,
      });

      // Create content retrieval tool
      const contentTool = this.createContentTool(server);
      this.tools.push(contentTool);

      this.toolConfigs.push({
        serverId: server.id,
        serverConfig: server,
        toolName: contentTool.name,
        description: `Get content from ${server.description}`,
      });

      // Create list types tool
      const typesTool = this.createListTypesTool(server);
      this.tools.push(typesTool);

      this.toolConfigs.push({
        serverId: server.id,
        serverConfig: server,
        toolName: typesTool.name,
        description: `List available content types from ${server.description}`,
      });

      logger.debug('MCPToolManager: Created tools for server', {
        serverId: server.id,
        toolCount: 3,
      });
    } catch (error) {
      logger.error('MCPToolManager: Failed to create tools for server', {
        serverId: server.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Create a search tool for the given server
   */
  private createSearchTool(server: MCPServerConfig): DynamicTool {
    const toolName = `search_${server.id}`;

    return new DynamicTool({
      name: toolName,
      description: `Search for content in ${server.description}. Input should be a search query string.`,
      func: async (query: string): Promise<string> => {
        try {
          logger.debug('MCPTool: Executing search', {
            serverId: server.id,
            toolName,
            query: query.substring(0, 100),
          });

          const client = new MCPClient(server);
          const result = await client.search(query, { limit: 10 });

          if (!result.success) {
            const errorMsg = `Search failed: ${result.error?.message || 'Unknown error'}`;
            logger.error('MCPTool: Search failed', {
              serverId: server.id,
              error: errorMsg,
            });
            return errorMsg;
          }

          const searchData = result.data!;
          const formattedResults = searchData.results
            .map(
              item =>
                `**${item.title}**\n${item.snippet}\n${item.url ? `URL: ${item.url}` : ''}\nID: ${item.id}`
            )
            .join('\n\n');

          const response = `Found ${searchData.results.length} results${searchData.hasMore ? ' (more available)' : ''}:\n\n${formattedResults}`;

          logger.info('MCPTool: Search completed successfully', {
            serverId: server.id,
            resultCount: searchData.results.length,
          });

          return response;
        } catch (error) {
          const errorMsg = `Search error: ${(error as Error).message}`;
          logger.error('MCPTool: Search exception', {
            serverId: server.id,
            error: errorMsg,
          });
          return errorMsg;
        }
      },
    });
  }

  /**
   * Create a content retrieval tool for the given server
   */
  private createContentTool(server: MCPServerConfig): DynamicTool {
    const toolName = `get_content_${server.id}`;

    return new DynamicTool({
      name: toolName,
      description: `Get full content by ID from ${server.description}. Input should be a content ID string.`,
      func: async (contentId: string): Promise<string> => {
        try {
          logger.debug('MCPTool: Executing get content', {
            serverId: server.id,
            toolName,
            contentId,
          });

          const client = new MCPClient(server);
          const result = await client.getContent(contentId, { includeMetadata: true });

          if (!result.success) {
            const errorMsg = `Get content failed: ${result.error?.message || 'Unknown error'}`;
            logger.error('MCPTool: Get content failed', {
              serverId: server.id,
              contentId,
              error: errorMsg,
            });
            return errorMsg;
          }

          const content = result.data!;
          const response = `**${content.title || 'Content'}**\n\n${content.content}${
            content.metadata ? `\n\nMetadata: ${JSON.stringify(content.metadata, null, 2)}` : ''
          }`;

          logger.info('MCPTool: Get content completed successfully', {
            serverId: server.id,
            contentId,
            contentLength: content.content.length,
          });

          return response;
        } catch (error) {
          const errorMsg = `Get content error: ${(error as Error).message}`;
          logger.error('MCPTool: Get content exception', {
            serverId: server.id,
            contentId,
            error: errorMsg,
          });
          return errorMsg;
        }
      },
    });
  }

  /**
   * Create a list types tool for the given server
   */
  private createListTypesTool(server: MCPServerConfig): DynamicTool {
    const toolName = `list_types_${server.id}`;

    return new DynamicTool({
      name: toolName,
      description: `List available content types/categories from ${server.description}. No input required.`,
      func: async (_input: string): Promise<string> => {
        try {
          logger.debug('MCPTool: Executing list types', {
            serverId: server.id,
            toolName,
          });

          const client = new MCPClient(server);
          const result = await client.listTypes();

          if (!result.success) {
            const errorMsg = `List types failed: ${result.error?.message || 'Unknown error'}`;
            logger.error('MCPTool: List types failed', {
              serverId: server.id,
              error: errorMsg,
            });
            return errorMsg;
          }

          const types = result.data!;
          const response = `Available content types:\n${types.map(type => `- ${type}`).join('\n')}`;

          logger.info('MCPTool: List types completed successfully', {
            serverId: server.id,
            typeCount: types.length,
          });

          return response;
        } catch (error) {
          const errorMsg = `List types error: ${(error as Error).message}`;
          logger.error('MCPTool: List types exception', {
            serverId: server.id,
            error: errorMsg,
          });
          return errorMsg;
        }
      },
    });
  }

  /**
   * Get all available tools
   */
  getTools(): DynamicTool[] {
    return this.tools;
  }

  /**
   * Get tool configurations
   */
  getToolConfigs(): MCPToolConfig[] {
    return this.toolConfigs;
  }

  /**
   * Get tools for a specific server
   */
  getToolsForServer(serverId: string): DynamicTool[] {
    const serverToolNames = this.toolConfigs
      .filter(config => config.serverId === serverId)
      .map(config => config.toolName);

    return this.tools.filter(tool => serverToolNames.includes(tool.name));
  }

  /**
   * Test all MCP connections
   */
  async testAllConnections(): Promise<Record<string, { success: boolean; message: string }>> {
    const results: Record<string, { success: boolean; message: string }> = {};

    const servers = await this.mcpConfigManager.loadActiveServers();

    for (const server of servers) {
      try {
        const client = new MCPClient(server);
        const testResult = await client.testConnection();

        results[server.id] = {
          success: testResult.success,
          message: testResult.success
            ? 'Connection successful'
            : testResult.error?.message || 'Connection failed',
        };
      } catch (error) {
        results[server.id] = {
          success: false,
          message: `Connection test failed: ${(error as Error).message}`,
        };
      }
    }

    return results;
  }

  /**
   * Refresh tools (reload configuration and recreate tools)
   */
  async refreshTools(): Promise<DynamicTool[]> {
    logger.debug('MCPToolManager: Refreshing tools');

    // Clear cache and reinitialize
    this.mcpConfigManager.refreshConfig();
    this.tools = [];
    this.toolConfigs = [];

    return await this.initializeTools();
  }
}
