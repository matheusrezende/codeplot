import { container } from 'tsyringe';

import { LoggerService } from './services/logger/logger.service';
import { ILoggerService } from './services/logger/logger.interface';

import { ConfigService } from './services/config/config.service';
import { IConfigService } from './services/config/config.interface';

import { McpService } from './services/mcp/mcp.service';
import { IMcpService } from './services/mcp/mcp.interface';

import { AgentService } from './services/agent/agent.service';
import { AgentServiceToken, IAgentService } from './services/agent/agent.interface';

container.registerSingleton<IAgentService>(AgentServiceToken, AgentService);
container.registerSingleton<IMcpService>('IMcpService', McpService);
container.registerSingleton<IConfigService>('IConfigService', ConfigService);
container.registerSingleton<ILoggerService>('ILoggerService', LoggerService);
export default container;
