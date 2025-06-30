### **Architecture Decision Record (ADR-001)**

**Title:** Multi-State Agent Behavior for Feature Planning

**Status:** Proposed

**Context:**
The current implementation of the 'dev' and 'pm' agents lacks specific instructions and a structured workflow. To be effective, they need to be context-aware of the user's codebase and guide the user through a collaborative process of requirement gathering, validation, and document generation (ADR/Plan for developers, PRD for product managers). The goal is to make the agent's behavior predictable, robust, and aligned with the user's end goal.

**Decision:**
We will implement a multi-state, context-aware agent that operates as follows:

1.  **Automatic Codebase Analysis:** Immediately after the user selects an agent ('dev' or 'pm'), the application will invoke the `pack_codebase` tool from the `repomix` MCP server. This tool will analyze the current working directory from which the `codeplot` CLI was executed.
2.  **Internal State Machine:** The agent's behavior will be governed by a system prompt that directs it to follow a multi-phase process. The user will have a single, continuous conversation with the agent, which will manage these states internally:
    - **Phase 1: Gather & Clarify:** Understand the user's high-level goal by asking clarifying questions.
    - **Phase 2: Validate against Codebase:** Use the context from `pack_codebase` to validate assumptions and identify potential conflicts or integration points.
    - **Phase 3: Propose Solutions:** Collaboratively design the feature by asking one question at a time, presenting numbered options, and recommending the best path forward.
    - **Phase 4: Generate Document:** Once sufficient information is gathered, generate the final document (ADR and implementation plan for 'dev', PRD for 'pm').
3.  **Strict Interaction Model:** The agent will be instructed to always ask one question at a time and present options using the existing `OptionSelector` format.

**Rejected Alternatives:**

- **Trigger Analysis on First User Prompt:** Rejected because running the analysis immediately after agent selection provides a better user experience, as the agent is fully prepared for the first user prompt.
- **Use Separate Agents for Each Phase:** Rejected because it would create a disjointed user experience, requiring the user to manually switch between different agents ('Analyst', 'Validator', etc.). A single, more intelligent agent is superior.
- **Invoke Phases via Explicit Tools:** Rejected as it adds complexity. Building the logic into the agent's core instructions is more efficient and reliable than having the agent decide when to call a `validate` or `gather` tool.

**Consequences:**

- **Pro:** The user experience will be significantly improved, feeling more like a guided, expert-led consultation. The agent's output will be of higher quality due to its access to codebase context. The interaction will be predictable and structured.
- **Con:** There will be a brief delay after agent selection while the codebase is being analyzed. The system prompt for the agent becomes more complex and critical to the application's function. The application is now dependent on the availability and reliability of the `pack_codebase` tool on the MCP server.

---

### **Implementation Plan**

Here is a shippable, step-by-step plan to implement this feature.

#### **Step 1: Integrate `pack_codebase` Tool into Agent Initialization**

The first step is to call the `pack_codebase` tool and feed its context into the agent's memory.

1.  **Modify `IAgentService` Interface:**
    - **File:** `src/services/agent/agent.interface.ts`
    - **Change:** Add a new method to the interface to handle the analysis.

    ```typescript
    // src/services/agent/agent.interface.ts
    export interface IAgentService {
      initialize(agentType: 'dev' | 'pm', tools: any[]): Promise<void>;
      // Add this new method
      getCodebaseContext(): Promise<string>;
      stream(input: string, threadId: string): AsyncGenerator<{ type: string; content: string }>;
    }
    ```

2.  **Implement `getCodebaseContext` in `AgentService`:**
    - **File:** `src/services/agent/agent.service.ts`
    - **Change:** Implement the new method. It should call the `pack_codebase` tool via the `mcpService` and return the result. We'll assume the tool returns a string.

    ```typescript
    // src/services/agent/agent.service.ts
    // ... imports

    export class AgentService implements IAgentService {
      // ... constructor and existing methods

      public async getCodebaseContext(): Promise<string> {
        this.logger.info('Attempting to call pack_codebase tool...');
        try {
          const context = await this.mcpService.callTool('pack_codebase', {});
          this.logger.info('Successfully received codebase context.');
          return context as string;
        } catch (error) {
          this.logger.error('Failed to get codebase context from pack_codebase tool.', error);
          return 'Error: Could not retrieve codebase context. Please proceed without it.';
        }
      }

      // ... rest of the class
    }
    ```

3.  **Update `App.tsx` to Call the Analysis:**
    - **File:** `src/components/App.tsx`
    - **Change:** Modify the `handleAgentSelect` function to call `getCodebaseContext` and then pass the context to the agent during initialization.

    ```tsx
    // src/components/App.tsx
    // ... imports

    export function App(...) {
      // ... state and other code

      const handleAgentSelect = async (agentType: 'dev' | 'pm') => {
        setInitializingMessage('Initializing agent...');
        setAppState('initializing');
        try {
          setInitializingMessage('Analyzing codebase (this may take a moment)...');
          const codebaseContext = await agentService.getCodebaseContext();

          setInitializingMessage('Finalizing agent setup...');
          await agentService.initialize(agentType, mcpService.getTools(), codebaseContext);

          setAppState('chatting');
        } catch (error) {
          logger.error('Initialization failed:', error);
          setAppState('error');
        }
      };

      // ... return statement with updated loading message
      {appState === 'initializing' && <Text>{initializingMessage}</Text>}
    }
    ```

#### **Step 2: Update Agent Instructions and State**

Now, we'll provide the new, detailed instructions to the agent.

1.  **Modify `initialize` to Accept Context:**
    - **File:** `src/services/agent/agent.interface.ts`
    - **Change:** Update the `initialize` method signature.

    ```typescript
    // src/services/agent/agent.interface.ts
    initialize(agentType: 'dev' | 'pm', tools: any[], codebaseContext: string): Promise<void>;
    ```

2.  **Create and Use the New System Prompts:**
    - **File:** `src/services/agent/agent.service.ts`
    - **Change:** Update the `initialize` method to use the new prompt that includes the state machine logic and the codebase context.

    ```typescript
    // src/services/agent/agent.service.ts

    // Add these prompts at the top of the file or in a separate constants file.
    const DEV_AGENT_PROMPT = (context: string) => `
    You are an expert senior software architect. Your goal is to help the user create a new feature by producing an Architecture Decision Record (ADR) and an implementation plan.

    **Codebase Context:**
    Here is the context of the current codebase. Use this to inform your questions and decisions.
    ---
    ${context}
    ---

    **Your Process:**
    You must follow these steps in order:
    1.  **Gather & Clarify:** Understand the user's high-level goal. Ask clarifying questions until the goal is clear.
    2.  **Validate:** Cross-reference the user's request with the provided codebase context to identify conflicts or integration points.
    3.  **Propose Solutions:** Guide the user to a final architecture.

    **Interaction Rules:**
    - Ask ONLY ONE question at a time.
    - After each question, you MUST provide at least two numbered options for the user to choose from.
    - You MUST recommend one of the options by marking it with "(Recommended)".
    - Wait for the user's response before proceeding.
    `;

    const PM_AGENT_PROMPT = (context: string) => `
    You are an expert product manager. Your goal is to help the user define a new feature by producing a Product Requirements Document (PRD).

    **Codebase Context:**
    Here is the context of the current codebase. Use this to understand technical feasibility.
    ---
    ${context}
    ---

    **Your Process:**
    You must follow these steps:
    1.  **Define Problem:** Understand the user problem this feature solves.
    2.  **Define Goals:** Clarify the success metrics and goals.
    3.  **Define Requirements:** Detail the user stories and functional requirements.

    **Interaction Rules:**
    - Ask ONLY ONE question at a time.
    - After each question, you MUST provide at least two numbered options for the user to choose from.
    - You MUST recommend one of the options by marking it with "(Recommended)".
    - Wait for the user's response before proceeding.
    `;

    // Update the initialize method
    public async initialize(agentType: 'dev' | 'pm', tools: McpTool[], codebaseContext: string): Promise<void> {
      const systemPrompt = agentType === 'dev'
        ? DEV_AGENT_PROMPT(codebaseContext)
        : PM_AGENT_PROMPT(codebaseContext);

      const systemMessage = new SystemMessage(systemPrompt);
      // ... rest of the langgraph/agent setup, ensuring this system message is
      // set as the initial message in the agent's memory/state.

      // For example, when setting up the graph state:
      this.graph = new StateGraph({
        channels: {
          messages: {
            value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
            default: () => [systemMessage], // <-- Ensure it starts with the prompt
          },
        },
      });
      // ... rest of initialization
    }
    ```

#### **Step 3: Testing and Validation**

1.  **Add Unit Tests:**
    - Create a test for `AgentService.getCodebaseContext` to ensure it properly calls the mocked `mcpService.callTool` with `'pack_codebase'`.
    - Update tests for `App.tsx` to verify that the new `initializingMessage` is displayed correctly during the analysis phase.
2.  **Manual End-to-End Test:**
    - Launch `codeplot` in a project directory.
    - Select the 'dev' agent.
    - Verify the "Analyzing codebase..." message appears.
    - Enter a simple prompt like: "I want to add a caching layer."
    - Confirm the agent's first response is a clarifying question, references the codebase, and provides numbered options with a recommendation.
