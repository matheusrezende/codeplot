import { inject, singleton } from 'tsyringe';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import type { IConfigService } from './config.interface';
import type { ILoggerService } from '../logger/logger.interface';
import { McpConfig, McpServer, McpConfigFileFormat } from '../../schemas/mcp-config.schema';

@singleton()
export class ConfigService implements IConfigService {
  private mcpConfig: McpConfig = { servers: [] };

  constructor(@inject('ILoggerService') private readonly logger: ILoggerService) {}

  public getMcpConfig(): McpConfig {
    return this.mcpConfig;
  }

  public async loadConfig(): Promise<McpConfig> {
    const globalConfigPath = path.join(os.homedir(), '.codeplot', 'mcp-config.json');
    const projectConfigPath = path.join(process.cwd(), '.codeplot', 'mcp-config.json');

    const globalConfig = await this.readConfigFile(globalConfigPath);
    const projectConfig = await this.readConfigFile(projectConfigPath);

    this.mcpConfig = this.mergeConfigs(globalConfig, projectConfig);
    this.logger.info(
      `Final merged MCP config loaded with ${this.mcpConfig.servers.length} servers.`
    );

    return this.mcpConfig;
  }

  private async readConfigFile(filePath: string): Promise<McpConfig | undefined> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      this.logger.info(`Successfully read config file: ${filePath}`);
      const rawConfig = JSON.parse(data) as McpConfigFileFormat;
      return this.normalizeConfig(rawConfig);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        this.logger.debug(`Config file not found, skipping: ${filePath}`);
      } else {
        this.logger.error(`Error reading or parsing config file ${filePath}:`, error);
      }
      return undefined;
    }
  }

  private normalizeConfig(rawConfig: McpConfigFileFormat): McpConfig {
    const servers: McpServer[] = [];

    // Handle new format (servers array)
    if (rawConfig.servers) {
      servers.push(...rawConfig.servers);
      this.logger.debug(`Found ${rawConfig.servers.length} servers in new format.`);
    }

    // Handle original format (mcpServers object)
    if (rawConfig.mcpServers) {
      const mcpServersCount = Object.keys(rawConfig.mcpServers).length;
      this.logger.debug(`Found ${mcpServersCount} servers in original mcpServers format.`);

      for (const [name, serverConfig] of Object.entries(rawConfig.mcpServers)) {
        servers.push({
          name,
          command: serverConfig.command,
          args: serverConfig.args,
          enabled: serverConfig.enabled ?? true, // Default to true if not specified
        });
        this.logger.debug(`Converted server "${name}" from mcpServers format.`);
      }
    }

    return { servers };
  }

  private mergeConfigs(globalConfig?: McpConfig, projectConfig?: McpConfig): McpConfig {
    if (!globalConfig && !projectConfig) {
      this.logger.warn('No global or project MCP config files found.');
      return { servers: [] };
    }

    const serverMap = new Map<string, McpServer>();

    if (globalConfig?.servers) {
      globalConfig.servers.forEach(server => serverMap.set(server.name, server));
      this.logger.debug(`Loaded ${serverMap.size} servers from global config.`);
    }

    if (projectConfig?.servers) {
      projectConfig.servers.forEach(server => {
        if (serverMap.has(server.name)) {
          this.logger.info(
            `Overriding global server config with project config for: ${server.name}`
          );
        } else {
          this.logger.info(`Adding new server from project config: ${server.name}`);
        }
        serverMap.set(server.name, server);
      });
    }

    return { servers: Array.from(serverMap.values()) };
  }
}
