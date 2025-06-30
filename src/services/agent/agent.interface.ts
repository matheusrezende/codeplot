export interface IAgentService {
  initialize(agentType: 'dev' | 'pm', tools: any[]): Promise<void>;
  stream(input: string, threadId: string): AsyncGenerator<{ type: string; content: string }>;
}

export const AgentServiceToken = Symbol('IAgentService');
