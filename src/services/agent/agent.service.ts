import { inject, singleton } from 'tsyringe';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { DynamicStructuredTool } from 'langchain/tools';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StateGraph, END, MemorySaver } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';

import { IAgentService } from './agent.interface';
import type { ILoggerService } from '../logger/logger.interface';
import type { IMcpService } from '../mcp/mcp.interface';
import { McpTool } from '../../common/mcp-tool';

interface AgentState {
  messages: BaseMessage[];
}

const DEV_AGENT_PROMPT = `
You are an expert senior software architect. Your goal is to help the user create a new feature by producing an Architecture Decision Record (ADR) and an implementation plan. You are a collaborator, not an implementer. You must not take any action without explicit user approval.

**Your Process:**
You must follow these steps in order, and you MUST ask for the user's approval before proceeding to the next step:
1.  **Analyze Codebase:** On the user's first message, you MUST call the 'pack_codebase' tool with the current working directory to get context.
2.  **Gather & Clarify:** Understand the user's high-level goal. Ask clarifying questions until the goal is clear.
3.  **Propose Architecture:** Based on the user's goal and the codebase context, propose a high-level architecture. Explain your reasoning and present the pros and cons. You MUST ask for approval before proceeding.
4.  **Create ADR:** Once the architecture is approved, create a detailed Architecture Decision Record (ADR). The ADR should be comprehensive and well-structured. You MUST ask for approval before proceeding.
5.  **Create Implementation Plan:** Once the ADR is approved, create a step-by-step implementation plan. The plan should be broken down into small, manageable tasks. You MUST ask for approval before proceeding.
6.  **Wait:** After the implementation plan is approved, you MUST stop and wait for further instructions.

**Interaction Rules:**
- Ask ONLY ONE question at a time.
- When you need the user to make a decision, you MUST call the \`requestUserChoice\` tool. Provide a clear question and at least two distinct options. You MUST set \`isRecommended\` to true for one of the options.
- Wait for the user's response before proceeding.
`;

const PM_AGENT_PROMPT = `
You are an expert product manager. Your goal is to help the user define a new feature by producing a Product Requirements Document (PRD).

**Your Process:**
You must follow these steps:
1.  **Analyze Codebase:** On the user's first message, you MUST call the 'pack_codebase' tool with the current working directory to get context.
2.  **Define Problem:** Understand the user problem this feature solves.
3.  **Define Goals:** Clarify the success metrics and goals.
4.  **Define Requirements:** Detail the user stories and functional requirements.

**Interaction Rules:**
- Ask ONLY ONE question at a time.
- When you need the user to make a decision, you MUST call the \`requestUserChoice\` tool. Provide a clear question and at least two distinct options. You MUST set \`isRecommended\` to true for one of the options.
- Wait for the user's response before proceeding.
`;

@singleton()
export class AgentService implements IAgentService {
  private runnable: any;

  constructor(
    @inject('ILoggerService') private readonly logger: ILoggerService,
    @inject('IMcpService') private readonly mcpService: IMcpService
  ) {}

  public async initialize(agentType: 'dev' | 'pm', tools: McpTool[]): Promise<void> {
    this.logger.info(`Initializing agent of type: ${agentType}`);
    this.logger.info(`Available tools: ${tools.length}`);

    const model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.5-pro',
      apiKey: process.env.GEMINI_API_KEY,
    });

    const dynamicTools = tools.map(
      tool =>
        new DynamicStructuredTool({
          name: tool.toolName,
          description: tool.description!,
          schema: tool.inputSchema as any,
          func: async (args: any) => {
            try {
              this.logger.debug(`Calling tool ${tool.toolName} with args:`, args);
              const result = await this.mcpService.callTool(tool.toolName, args);
              return JSON.stringify(result);
            } catch (error) {
              this.logger.error(`Error calling tool ${tool.toolName}:`, error);
              return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
          },
        })
    );

    const humanTool = new DynamicStructuredTool({
      name: 'ask_human',
      description:
        'Asks the human for input. Use this when you need clarification or feedback before proceeding.',
      schema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to ask the human.',
          },
        },
        required: ['question'],
      } as any,
      func: async (): Promise<string> => 'Pausing for human input.',
    });

    const requestUserChoiceTool = new DynamicStructuredTool({
      name: 'requestUserChoice',
      description:
        'Asks the user to make a choice from a set of options. Use this when you need user input to proceed.',
      schema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to ask the user.',
          },
          options: {
            type: 'array',
            description: 'An array of options for the user to choose from.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'The short title for the option.' },
                description: {
                  type: 'string',
                  description: 'A detailed description of the option.',
                },
                isRecommended: {
                  type: 'boolean',
                  description: 'Whether this option is recommended.',
                },
              },
              required: ['title', 'description'],
            },
          },
        },
        required: ['question', 'options'],
      } as any,
      func: async (): Promise<string> => 'Pausing for user choice.',
    });

    const allTools: DynamicStructuredTool[] = [...dynamicTools, humanTool, requestUserChoiceTool];
    const modelWithTools = model.bindTools(allTools);
    const toolNode = new ToolNode<AgentState>(allTools);
    const memory = new MemorySaver();

    const systemPrompt = agentType === 'dev' ? DEV_AGENT_PROMPT : PM_AGENT_PROMPT;

    const systemMessage = new SystemMessage(systemPrompt);

    const graph = new StateGraph<AgentState>({
      channels: {
        messages: {
          value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
          default: () => [systemMessage],
        },
      },
    })
      .addNode('agent', async state => {
        const response = await modelWithTools.invoke(state.messages);
        return { messages: [response] };
      })
      .addNode('tools', toolNode)
      .addNode('human_in_the_loop', async () => {
        return {};
      })
      .setEntryPoint('agent');

    graph.addConditionalEdges('agent', state => {
      const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
      if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        if (
          lastMessage.tool_calls.some(
            tc => tc.name === 'ask_human' || tc.name === 'requestUserChoice'
          )
        ) {
          return 'human_in_the_loop';
        }
        return 'tools';
      }
      return END;
    });
    graph.addEdge('tools', 'agent');
    graph.addEdge('human_in_the_loop', 'agent');

    this.runnable = graph.compile({ checkpointer: memory });
    this.logger.info('Agent initialized successfully.');
  }

  public async *stream(
    input: string,
    threadId: string
  ): AsyncGenerator<{ type: string; content: string }> {
    if (!this.runnable) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    this.logger.debug(`Starting stream for input: ${input}`);

    const initialState: AgentState = {
      messages: [new HumanMessage(input)],
    };

    const stream = await this.runnable.stream(initialState, {
      configurable: { thread_id: threadId },
    });

    let mostRecentStateWithMessages: AgentState | null = null;

    for await (const step of stream) {
      const stepName = Object.keys(step)[0];
      if (stepName === '__end__') continue;

      const stepState = Object.values(step)[0] as AgentState;
      this.logger.debug(`Executing step: ${stepName}`);

      if (stepState.messages && Array.isArray(stepState.messages)) {
        mostRecentStateWithMessages = stepState;
      }

      const stateToUse = mostRecentStateWithMessages;

      if (stepName === 'agent') {
        const lastMessage = stepState.messages[stepState.messages.length - 1] as AIMessage;
        this.logger.debug('Agent step lastMessage:', lastMessage);
        if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
          yield { type: 'thinking', content: 'Thinking...' };
          for (const toolCall of lastMessage.tool_calls) {
            yield {
              type: 'tool_call',
              content: toolCall.name,
            };
          }
        }
        if (Array.isArray(lastMessage.content)) {
          for (const part of lastMessage.content) {
            if (part.type === 'text') {
              yield { type: 'agent', content: part.text };
            }
          }
        } else if (lastMessage.content && typeof lastMessage.content === 'string') {
          yield { type: 'agent', content: lastMessage.content };
        }
      } else if (stepName === 'human_in_the_loop') {
        if (!stateToUse) {
          this.logger.error('Entered human_in_the_loop without a preceding agent state.');
          return;
        }
        const lastMessage = stateToUse.messages[stateToUse.messages.length - 1] as AIMessage;

        const userChoiceToolCall = lastMessage.tool_calls?.find(
          tc => tc.name === 'requestUserChoice'
        );
        if (userChoiceToolCall?.args) {
          yield { type: 'user_choice_required', content: JSON.stringify(userChoiceToolCall.args) };
          return;
        }

        const humanQueryToolCall = lastMessage.tool_calls?.find(tc => tc.name === 'ask_human');
        if (humanQueryToolCall?.args) {
          const question = humanQueryToolCall.args.question;
          yield { type: 'human_input_required', content: question };
          return;
        }
      } else if (stepName === 'tools') {
        if (!stateToUse) {
          this.logger.error('In tools node, but no state with messages is available.');
          return;
        }
        const lastMessage = stateToUse.messages[stateToUse.messages.length - 1];
        if (Array.isArray(lastMessage.content)) {
          for (const toolOutput of lastMessage.content) {
            yield { type: 'tool', content: JSON.stringify(toolOutput, null, 2) };
          }
        }
        yield { type: 'tool_end', content: 'Finished using tools.' };
      }
    }
  }
}
