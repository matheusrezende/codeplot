import { inject, singleton } from 'tsyringe';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicTool } from 'langchain/tools';
import { IAgentService } from './agent.interface';
import type { ILoggerService } from '../logger/logger.interface';
import type { IMcpService } from '../mcp/mcp.interface';
import { McpTool } from '../../common/mcp-tool';

@singleton()
export class AgentService implements IAgentService {
  private agentExecutor: AgentExecutor | undefined;

  constructor(
    @inject('ILoggerService') private readonly logger: ILoggerService,
    @inject('IMcpService') private readonly mcpService: IMcpService
  ) {}

  public async initialize(agentType: 'dev' | 'pm', tools: McpTool[]): Promise<void> {
    this.logger.info(`Initializing agent of type: ${agentType}`);
    this.logger.info(`Available tools: ${tools.length}`);

    const model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.5-pro',
      maxOutputTokens: 2048,
      apiKey: process.env.GEMINI_API_KEY,
    });

    const dynamicTools = tools.map(
      tool =>
        new DynamicTool({
          name: tool.toolName,
          description: tool.description || 'A tool provided by an MCP server.',
          func: async input => {
            try {
              const result = await this.mcpService.callTool(tool.toolName, input);
              return JSON.stringify(result);
            } catch (error) {
              this.logger.error(`Error calling tool ${tool.toolName}:`, error);
              return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
          },
        })
    );

    const promptTemplate = this.getPromptTemplate(agentType);
    const agent = await createToolCallingAgent({
      llm: model,
      tools: dynamicTools,
      prompt: promptTemplate,
    });

    this.agentExecutor = new AgentExecutor({
      agent,
      tools: dynamicTools,
      verbose: false,
    });

    this.logger.info('Agent initialized successfully.');
  }

  public async *stream(input: string): AsyncGenerator<{ type: string; content: string }> {
    if (!this.agentExecutor) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    this.logger.debug(`Starting stream for input: ${input}`);

    try {
      const eventStream = this.agentExecutor.streamEvents({ input }, { version: 'v1' });
      let hasYieldedContent = false;

      for await (const event of eventStream) {
        this.logger.debug(`Received event: ${event.event}`);

        if (event.event === 'on_chat_model_stream') {
          const chunk = event.data.chunk;
          if (typeof chunk.content === 'string') {
            hasYieldedContent = true;
            yield { type: 'agent', content: chunk.content };
          }
        } else if (event.event === 'on_llm_stream') {
          // Alternative event type that might be used
          const chunk = event.data.chunk;
          if (typeof chunk.text === 'string') {
            hasYieldedContent = true;
            yield { type: 'agent', content: chunk.text };
          }
        }
      }

      // If no content was streamed, try a fallback approach
      if (!hasYieldedContent) {
        this.logger.warn('No content was streamed, attempting fallback approach');
        const result = await this.agentExecutor.invoke({ input });
        if (result.output) {
          yield { type: 'agent', content: result.output };
        }
      }
    } catch (error) {
      this.logger.error('Error during streaming:', error);
      // Fallback to non-streaming approach
      try {
        this.logger.info('Attempting fallback to non-streaming approach');
        const result = await this.agentExecutor.invoke({ input });
        if (result.output) {
          yield { type: 'agent', content: result.output };
        } else {
          yield {
            type: 'agent',
            content:
              'I apologize, but I encountered an error processing your request. Please try again.',
          };
        }
      } catch (fallbackError) {
        this.logger.error('Fallback approach also failed:', fallbackError);
        yield {
          type: 'agent',
          content: `Error: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error occurred'}`,
        };
      }
    }
  }

  private getPromptTemplate(agentType: 'dev' | 'pm'): ChatPromptTemplate {
    const developerPrompt = `You are a senior software developer. Your task is to assist with planning and implementing software features. Use the available tools to gather information and perform actions.`;
    const pmPrompt = `You are a product manager. Your task is to create detailed Product Requirements Documents (PRDs). Use the available tools to research and define product features.`;

    const systemMessage = agentType === 'dev' ? developerPrompt : pmPrompt;

    return ChatPromptTemplate.fromMessages([
      ['system', systemMessage],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);
  }
}
