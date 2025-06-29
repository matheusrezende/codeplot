import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';
import { MCPConfig, MCPServerConfig } from '../types/mcp.js';

@injectable()
export class MCPConfigManager {
  private projectPath: string;
  private cachedConfig: MCPConfig | null = null;

  constructor(@inject('ProjectPath') projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Load and return active MCP server configurations
   */
  async loadActiveServers(): Promise<MCPServerConfig[]> {
    try {
      const config = await this.loadConfig();

      if (!config || !config.servers) {
        logger.debug('MCPConfigManager: No MCP servers configured');
        return [];
      }

      // Filter enabled servers (default to enabled if not specified)
      const activeServers = config.servers.filter(server => server.enabled !== false);

      logger.info('MCPConfigManager: Loaded active MCP servers', {
        totalServers: config.servers.length,
        activeServers: activeServers.length,
        serverIds: activeServers.map(s => s.id),
      });

      return activeServers;
    } catch (error) {
      logger.error('MCPConfigManager: Failed to load active servers', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Load MCP configuration from file
   */
  private async loadConfig(): Promise<MCPConfig | null> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    const configPaths = this.getConfigPaths();

    for (const configPath of configPaths) {
      try {
        if (await fs.pathExists(configPath)) {
          logger.debug('MCPConfigManager: Found config file', { path: configPath });

          const rawConfig = await fs.readFile(configPath, 'utf-8');
          const config = this.parseConfig(rawConfig);

          if (config) {
            this.validateConfig(config);
            this.cachedConfig = config;
            logger.info('MCPConfigManager: Successfully loaded config', {
              path: configPath,
              serverCount: config.servers?.length || 0,
            });
            return config;
          }
        }
      } catch (error) {
        logger.warn('MCPConfigManager: Failed to load config from path', {
          path: configPath,
          error: (error as Error).message,
        });
      }
    }

    logger.debug('MCPConfigManager: No valid config file found');
    return null;
  }

  /**
   * Get potential config file paths in order of priority
   */
  private getConfigPaths(): string[] {
    const paths: string[] = [];

    // Project-specific config (highest priority)
    paths.push(path.join(this.projectPath, '.codeplot', 'mcp-config.jsonc'));
    paths.push(path.join(this.projectPath, '.codeplot', 'mcp-config.json'));

    // Global user config (lower priority)
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
      paths.push(path.join(homeDir, '.config', 'codeplot', 'mcp-config.jsonc'));
      paths.push(path.join(homeDir, '.config', 'codeplot', 'mcp-config.json'));
    }

    return paths;
  }

  /**
   * Parse config file content (supports JSON and JSONC)
   */
  private parseConfig(content: string): MCPConfig | null {
    try {
      // Remove comments for JSONC support
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      return JSON.parse(cleanContent) as MCPConfig;
    } catch (error) {
      logger.error('MCPConfigManager: Failed to parse config', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(config: MCPConfig): void {
    if (!config.servers || !Array.isArray(config.servers)) {
      throw new Error('Config must have a "servers" array');
    }

    for (const server of config.servers) {
      this.validateServerConfig(server);
    }
  }

  /**
   * Validate individual server configuration
   */
  private validateServerConfig(server: MCPServerConfig): void {
    const required = ['id', 'description', 'baseUrl', 'auth'];

    for (const field of required) {
      if (!server[field as keyof MCPServerConfig]) {
        throw new Error(`Server config missing required field: ${field}`);
      }
    }

    // Validate auth configuration
    if (!server.auth.type) {
      throw new Error(`Server "${server.id}" missing auth.type`);
    }

    if (server.auth.type === 'env' && !server.auth.variable) {
      throw new Error(`Server "${server.id}" with env auth missing auth.variable`);
    }

    if (server.auth.type === 'static' && !server.auth.value) {
      throw new Error(`Server "${server.id}" with static auth missing auth.value`);
    }

    // Validate URL format
    try {
      new URL(server.baseUrl);
    } catch {
      throw new Error(`Server "${server.id}" has invalid baseUrl: ${server.baseUrl}`);
    }
  }

  /**
   * Get configuration for a specific server
   */
  async getServerConfig(serverId: string): Promise<MCPServerConfig | null> {
    const servers = await this.loadActiveServers();
    return servers.find(server => server.id === serverId) || null;
  }

  /**
   * Refresh cached configuration
   */
  refreshConfig(): void {
    this.cachedConfig = null;
  }

  /**
   * Create example configuration file
   */
  async createExampleConfig(): Promise<string> {
    const exampleConfig: MCPConfig = {
      servers: [
        {
          id: 'work_notion',
          description:
            "Searches the company's Notion workspace for PRDs, documentation, and project plans.",
          baseUrl: 'https://mcp.notion.com/v1',
          auth: {
            type: 'env',
            variable: 'NOTION_API_KEY',
          },
          enabled: true,
        },
        {
          id: 'atlassian_jira',
          description:
            'Fetches and searches for tickets, epics, and user stories in the Atlassian Jira instance.',
          baseUrl: 'https://mcp.atlassian.net/v1',
          auth: {
            type: 'env',
            variable: 'JIRA_API_TOKEN',
          },
          enabled: false,
        },
      ],
    };

    const configDir = path.join(this.projectPath, '.codeplot');
    const configPath = path.join(configDir, 'mcp-config.jsonc');

    await fs.ensureDir(configDir);
    await fs.writeFile(configPath, JSON.stringify(exampleConfig, null, 2), 'utf-8');

    logger.info('MCPConfigManager: Created example config', { path: configPath });
    return configPath;
  }
}
