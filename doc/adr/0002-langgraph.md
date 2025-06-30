### ADR-001: Agent Architecture Refactor for Reliability and Human-in-the-Loop Interaction

**Date**: 2025-06-30

**Status**: Decided

#### Context

The current agent implementation, located in `src/services/agent/agent.service.ts`, uses LangChain's `AgentExecutor`. It interacts with tools managed by `McpService`.

Two primary issues have been identified:

1.  **Unreliable Tool Calls**: The agent passes a natural language string to tools. The `McpService` then uses a fragile, pattern-based function (`parseNaturalLanguageArgs`) to extract parameters. This is prone to errors when the AI's output format varies slightly.
2.  **Limited Interaction Model**: `AgentExecutor` supports a linear, turn-based flow (User -> Agent -> Tool -> Response). This restricts the ability to build more collaborative workflows where the agent might need to pause its multi-step process to ask for clarification or validation from the user before proceeding.

The goal is to increase the reliability of agent-tool interactions and enable more sophisticated, stateful human-in-the-loop workflows.

#### Decision

We will undertake a two-part refactor of the agent architecture:

1.  **Adopt Structured Tool Arguments**: We will leverage the existing `inputSchema` property on the `McpTool` interface. The agent will be configured to generate a structured JSON object for tool arguments that conforms to this schema. This eliminates the need for the `parseNaturalLanguageArgs` function, which will be removed. The `McpService.callTool` method will be updated to accept this structured data directly.

2.  **Migrate to LangGraph**: We will replace the `AgentExecutor` with a state machine (a graph) built using LangGraph. This graph will define the agent's control flow, including nodes for calling the model, executing tools, and a new node designed to explicitly pause and wait for human input. This provides a flexible foundation for complex, interactive processes.

#### Consequences

**Positive:**

- **Increased Reliability**: Tool calls will become significantly more robust as they will no longer depend on fragile string parsing.
- **Enhanced Maintainability**: Removing the custom parsing logic simplifies the `McpService` and makes the system easier to debug and extend.
- **Advanced Interactivity**: LangGraph enables stateful workflows, allowing the agent to pause for user feedback during a task, leading to a more collaborative user experience.
- **Clearer Separation of Concerns**: The LLM's responsibility is clearly defined as generating structured data for tools, and the `McpService`'s responsibility is purely executing them.

**Negative:**

- **Increased Initial Complexity**: The logic within `AgentService` will become more explicit and verbose, as we are defining a graph and its state transitions manually instead of using a pre-built executor.
- **New Dependency**: A new dependency on `@langchain/langgraph` will be introduced.
- **Refactoring Effort**: This change requires a significant refactor of `agent.service.ts` and corresponding updates to the `ChatWindow.tsx` component to handle the new "human input required" state.

#### Rejected Alternatives

1.  **Improve the Existing Parser**: We could attempt to make `parseNaturalLanguageArgs` more robust with more complex regex or NLP techniques.
    - **Reason for Rejection**: This path leads to brittle, high-maintenance code. Any pattern-based approach will inevitably fail to cover all possible variations in the LLM's output. It is treating the symptom, not the cause.

2.  **Use `AgentExecutor` with Structured Tools**: We could implement structured arguments (Decision 1) but keep the `AgentExecutor` (i.e., not migrate to LangGraph).
    - **Reason for Rejection**: While this would solve the reliability issue, it would not address the need for advanced human-in-the-loop interaction. The linear nature of `AgentExecutor` is insufficient for workflows that require the agent to pause mid-task for user validation. This would be a short-sighted fix that ignores a key product requirement.

---

With the decision recorded, here is the step-by-step implementation plan.

### Implementation Plan

This plan breaks the refactor into three distinct, shippable stages.

#### Step 1: Replace `AgentExecutor` with a Basic LangGraph Implementation

The first step is to replace the core agent logic without yet changing the tool structure or UI. This establishes the new architectural foundation.

1.  **Update Dependencies:**
    - In `package.json`, add the LangGraph library:
      ```bash
      npm install @langchain/langgraph
      ```

2.  **Define Agent State:**
    - In `src/services/agent/agent.service.ts`, define the state for your graph. This state will be passed between the nodes.

      ```typescript
      import { BaseMessage } from '@langchain/core/messages';

      interface AgentState {
        messages: BaseMessage[];
      }
      ```

3.  **Refactor `AgentService` to use LangGraph:**
    - Modify `src/services/agent/agent.service.ts` to build and compile a graph.
    - Remove the `AgentExecutor` and the `createToolCallingAgent` call.
    - Define the nodes (functions that represent steps) and edges (logic that routes between steps) for your graph.

    _Code Stub for `agent.service.ts`_:

    ```typescript
    import { StateGraph, END } from '@langchain/langgraph';
    import { ToolNode } from '@langchain/langgraph/prebuilt';
    // ... other imports

    // (Keep AgentState interface from above)

    export class AgentService implements IAgentService {
      private agent: StateGraph<AgentState>;
      // ... constructor and other properties

      public async initialize(agentType: 'dev' | 'pm', tools: McpTool[]): Promise<void> {
        // ... (tool creation will be updated in Step 2)
        const dynamicTools = tools.map(
          tool =>
            new DynamicTool({
              /*...*/
            })
        );
        const toolNode = new ToolNode<AgentState>(dynamicTools);

        const model = new ChatGoogleGenerativeAI({
          model: 'gemini-2.5-pro',
          // ... other config
        });

        // This binds the tools to the model for structured calling
        const modelWithTools = model.bindTools(dynamicTools);

        // Define the graph
        const graph = new StateGraph<AgentState>({
          channels: {
            messages: {
              value: (x, y) => x.concat(y),
              default: () => [],
            },
          },
        })
          .addNode('agent', async state => {
            const response = await modelWithTools.invoke(state.messages);
            return { messages: [response] };
          })
          .addNode('tools', toolNode)
          .setEntryPoint('agent');

        // Define conditional edges
        graph.addConditionalEdges('agent', state => {
          const lastMessage = state.messages[state.messages.length - 1];
          if (lastMessage.tool_calls?.length > 0) {
            return 'tools'; // If tool calls are present, go to tool node
          }
          return END; // Otherwise, end the process
        });

        graph.addEdge('tools', 'agent'); // After tools, go back to agent for summary

        this.agent = graph;
      }

      public async *stream(input: string): AsyncGenerator<{ type: string; content: string }> {
        const runnable = this.agent.compile();
        const stream = await runnable.stream({ messages: [new HumanMessage({ content: input })] });

        for await (const output of stream) {
          if (output.__end__) continue;
          // This part needs to be adapted based on what you want to stream to the UI
          // For now, we can stream the final agent response
          const lastMessage = output.agent.messages[output.agent.messages.length - 1];
          if (lastMessage.content) {
            yield { type: 'agent-response', content: lastMessage.content as string };
          }
        }
      }
    }
    ```

#### Step 2: Integrate Structured Tool Schemas and Simplify `McpService`

Now, we'll fix the unreliable tool argument passing.

1.  **Update `DynamicTool` Creation:**
    - In `src/services/agent/agent.service.ts`, modify the tool creation logic within `initialize` to pass the `inputSchema`. LangChain uses `zod` for schemas, but you can pass a JSON schema-like object.

    _Code Stub for `DynamicTool` creation:_

    ```typescript
    const dynamicTools = tools.map(
      tool =>
        new DynamicTool({
          name: tool.toolName,
          description: tool.description,
          schema: tool.inputSchema, // Pass the schema here!
          func: async args => {
            // 'args' is now a structured object, e.g., { "param1": "value1" }
            const result = await this.mcpService.callTool(tool.toolName, args);
            return JSON.stringify(result);
          },
        })
    );
    ```

2.  **Simplify `McpService`:**
    - In `src/services/mcp/mcp.interface.ts`, update the `callTool` signature.
      ```typescript
      // Change this:
      // callTool(toolName: string, args: unknown): Promise<unknown>;
      // To this:
      callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
      ```
    - In `src/services/mcp/mcp.service.ts`:
      - Delete the entire `parseNaturalLanguageArgs` function. It is no longer needed.
      - Update `callTool` to use the `args` object directly. The logic that dispatches the call to the correct client remains the same.

#### Step 3: Implement Human-in-the-Loop UI and Graph Node

This final step brings the interactive element to life.

1.  **Add a "Human" Node to the Graph:**
    - In `src/services/agent/agent.service.ts`, add a new node to your graph for handling human input.
    - Define a special tool, maybe named `ask_human`, that the agent can call. When this tool is called, the graph will transition to the `human` node and pause.

    _Code Stub for graph modifications in `agent.service.ts`:_

    ```typescript
    // In initialize method...
    // 1. Add a 'human_in_the_loop' node
    graph.addNode('human_in_the_loop', async state => {
      // This node doesn't do anything, it's just a state to wait in.
      // The graph will be paused here.
      return { messages: [] };
    });

    // 2. Modify the edge logic
    graph.addConditionalEdges('agent', state => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage.tool_calls?.length > 0) {
        // Check for our special 'ask_human' tool
        if (lastMessage.tool_calls.some(tc => tc.name === 'ask_human')) {
          return 'human_in_the_loop';
        }
        return 'tools';
      }
      return END;
    });

    // 3. Add a new edge for when the human responds
    graph.addEdge('human_in_the_loop', 'agent');
    ```

2.  **Update `stream` to Handle Pausing:**
    - The `stream` method needs to yield a special event when the graph is paused at the `human_in_the_loop` node.

    _Code Stub for `stream` method in `agent.service.ts`:_

    ```typescript
     public async *stream(input: string): AsyncGenerator<{ type: string; content: string; }> {
        const runnable = this.agent.compile();
        const stream = await runnable.stream({ messages: [new HumanMessage({ content: input })] }, { configurable: { thread_id: "some_unique_id" }}); // Need thread_id for state

        for await (const output of stream) {
          // If we are at the human_in_the_loop node, yield a waiting event
          if (output.human_in_the_loop) {
            const lastMessage = output.agent.messages[output.agent.messages.length - 1];
            // Extract the question for the human from the tool_call arguments
            const humanQuery = lastMessage.tool_calls.find(tc => tc.name === 'ask_human').args.question;
            yield { type: 'human_input_required', content: humanQuery };
            return; // Stop the generator here and wait
          }

          // ... rest of streaming logic ...
        }
      }
    ```

3.  **Update `ChatWindow.tsx` to handle the new state:**
    - In `ChatWindow.tsx`, add a new state to manage when the UI is waiting for the user.
      ```typescript
      const [isWaitingForHuman, setIsWaitingForHuman] = useState(false);
      const [agentQuestion, setAgentQuestion] = useState('');
      ```
    - In the `useEffect` that consumes the agent's stream, check for the new event type.
      ```typescript
      // Inside the loop that processes the stream
      if (chunk.type === 'human_input_required') {
        setIsWaitingForHuman(true);
        setAgentQuestion(chunk.content);
        setLoading(false);
      } else {
        // ... handle normal messages
      }
      ```
    - Conditionally render a `TextInput` component when `isWaitingForHuman` is true, allowing the user to provide their feedback. When they submit, this feedback needs to be sent back to the agent service to continue the graph's execution.
