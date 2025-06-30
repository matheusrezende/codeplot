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
  private lastOutputId: string | undefined;

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
          description: tool.description!,
          func: async (input: string) => {
            try {
              this.logger.debug(`Raw input for ${tool.toolName}:`, input);

              // Try to parse the input as JSON arguments first
              let args: any;
              try {
                args = JSON.parse(input);
                this.logger.debug(`Parsed JSON args for ${tool.toolName}:`, args);
              } catch {
                // If not JSON, the input might be a natural language string
                // Let the MCP service handle the parsing
                this.logger.debug(`Using raw input for ${tool.toolName}:`, input);
                args = input;
              }

              const result = await this.mcpService.callTool(tool.toolName, args);

              // Track output IDs for tools that generate them
              if (result && typeof result === 'object' && 'outputId' in result) {
                this.lastOutputId = (result as any).outputId;
                this.logger.debug(`Tracked output ID: ${this.lastOutputId}`);
              }

              return JSON.stringify(result);
            } catch (error) {
              this.logger.error(`Error calling tool ${tool.toolName}:`, error);
              return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
          },
        })
    );

    const promptTemplate = this.getPromptTemplate(agentType, dynamicTools);

    this.logger.debug('\nPROMPT TEMPLATE ', promptTemplate);
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

  private getPromptTemplate(agentType: 'dev' | 'pm', tools: DynamicTool[]): ChatPromptTemplate {
    const currentDirectory = process.cwd();
    const toolsDescription = tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n');

    const developerPrompt = `You are a Senior Software Architect focused on FEATURE PLANNING ONLY.

Your SOLE responsibility is to ask clarifying questions to understand a feature request in complete detail. You must NEVER generate ADRs, implementation plans, or code suggestions.

CRITICAL TOOL USAGE INSTRUCTIONS:
1. ALL tool arguments MUST be provided as valid JSON objects, never as natural language
2. Before analyzing any user query, MUST first use pack_codebase tool to analyze the current codebase
3. Always read tool descriptions carefully for required parameters and provide all required fields
4. When using grep_repomix_output, use the outputId from the previous pack_codebase result

## Your Process:
1. First call pack_codebase with the directory parameter set to the current working directory
2. Use the returned outputId for any follow-up grep_repomix_output calls if needed
3. Analyze the feature request and codebase context
4. Ask ONE focused clarifying question at a time
5. Continue until you have complete understanding of:
   - Exact feature behavior and requirements
   - User interactions and edge cases
   - Data flows and business rules
   - Integration points with existing code
   - Performance and security considerations

## Response Format:
You MUST respond using this semantic markdown format:

# [Brief section title]

[Your analysis and context in markdown format]

**[Your clarifying question]**

1. **[First option title]** ⭐ RECOMMENDED
   [Detailed explanation of this option]

2. **[Second option title]**
   [Detailed explanation of this option]

3. **[Third option title]**
   [Detailed explanation of this option]

## Important formatting rules:
- Use exactly one # header at the start
- Put your question in **bold** before the options
- Number options starting from 1
- Mark your recommended option with ⭐ RECOMMENDED
- Keep option titles concise but descriptive
- Provide detailed explanations under each option

## Critical Rules:
- NEVER generate implementation plans or code
- NEVER create ADRs or architectural decisions
- Focus only on understanding requirements completely
- Ask about edge cases, error handling, performance needs
- Explore integration with existing systems
- Consider user experience and business rules

## When NOT Ready for ADR:
- Missing user interaction details
- Unclear data requirements
- Unknown integration points
- Undefined error handling
- Missing performance requirements
- Unclear business rules

## When Ready for ADR:
Only when you have complete understanding of:
✓ Exact feature behavior
✓ All user interactions
✓ Complete data requirements
✓ Integration points identified
✓ Error handling defined
✓ Performance requirements clear
✓ Security considerations addressed

TOOL ARGUMENT EXAMPLES (use actual values, not these templates):
- For pack_codebase: provide directory as absolute path
- For grep_repomix_output: provide outputId from previous call and pattern to search
- For file_system_read_directory: provide path as absolute path

REMEMBER: Tool arguments must be JSON objects with actual values, not template strings.

IMPORTANT: You are currently working in the directory: ${currentDirectory}

Available tools: 
${toolsDescription}`;

    const pmPrompt = `You are a product manager. Your task is to create detailed Product Requirements Documents (PRDs). 

IMPORTANT: You are currently working in the directory: ${currentDirectory}

CRITICAL TOOL USAGE INSTRUCTIONS:
1. ALL tool arguments MUST be provided as valid JSON objects, never as natural language
2. Before answering any user query, MUST first use pack_codebase tool to analyze the current codebase
3. Always read tool descriptions carefully for required parameters and provide all required fields
4. When using grep_repomix_output, use the outputId from the previous pack_codebase result




REMEMBER: Tool arguments must be JSON objects with actual values, not template strings.`;

    const systemMessage = agentType === 'dev' ? developerPrompt : pmPrompt;

    return ChatPromptTemplate.fromMessages([
      ['system', systemMessage],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);
  }
}
