### Architecture Decision Record (ADR)

**Title**: 001: Introduce `requestUserChoice` Tool for Presenting Options to the User

**Status**: Proposed

**Context**:
The current system relies on the agent formatting questions and selectable options in a specific Markdown structure. A parsing utility (`response-parser.ts`) on the client-side is responsible for interpreting this Markdown to render an interactive `OptionSelector`. This approach is brittle; any deviation in the agent's output format can break the UI. It tightly couples the agent's conversational logic with the UI's presentation logic.

**Decision**:
We will introduce a new, dedicated tool named `requestUserChoice`. The agent will be explicitly prompted to call this tool whenever it needs to ask the user to make a decision from a list of options.

This change decouples the agent's decision-making process from the UI's presentation.

1.  **Tool Definition**: A new tool, `requestUserChoice`, will be defined within the `AgentService`. It will not be an MCP tool but will be handled internally by the agent's control flow. Its function is to signal the UI to render the option selector.
    - **Name**: `requestUserChoice`
    - **Input Schema**:
      ```typescript
      {
        question: string, // The question to ask the user.
        options: Array<{
          title: string,       // The short, selectable text for the option.
          description: string, // A longer explanation shown in the UI.
          isRecommended?: boolean
        }>
      }
      ```

2.  **Agent Prompt Modification**: The system prompts for both the Developer and PM agents will be updated to remove instructions about Markdown formatting for questions. Instead, they will be explicitly instructed to use the `requestUserChoice` tool.

3.  **Agent Service & UI Communication**:
    - When the agent's underlying graph model identifies a call to `requestUserChoice`, it will trigger a new event type, `user_choice_required`.
    - The `AgentService`'s `stream` method will yield this event, including the `question` and `options` from the tool call arguments.
    - The `ChatWindow.tsx` component will listen for this event and use the provided data to render the `OptionSelector` component directly.

4.  **UI Interaction**:
    - When a user selects an option, the `ChatWindow` will send the `option.title` back to the agent as a `HumanMessage`.
    - The user's ability to type a free-text response instead of selecting an option will be preserved.

5.  **Code Cleanup**: The `parseAgentResponse` function will be simplified or removed, as it will no longer be needed for parsing options from Markdown.

**Rejected Alternatives**:

- **Continue using Markdown parsing**: Rejected due to its brittleness and the tight coupling between the agent and the UI.
- **Make the tool an MCP tool**: Rejected because presenting options is a core UI concern of this specific client application, not a general-purpose capability suitable for an external MCP server.
- **Send structured JSON back from the UI on selection**: Rejected as an over-complication. Sending the simple option `title` as a human message is sufficient for the agent to proceed and keeps the conversational history clean.

**Consequences**:

- **Positive**:
  - Increases system robustness by creating a clear, explicit contract between the agent and the UI.
  - Decouples agent logic from UI presentation, simplifying prompts and reducing maintenance.
  - Removes brittle parsing code (`response-parser.ts`).
- **Negative**:
  - Requires coordinated changes in `AgentService` and `ChatWindow`.
  - Introduces a new event type that must be handled by the UI stream processor.

---

### Implementation Plan

Here is the step-by-step plan to implement this feature.

**Step 1: Modify `agent.service.ts`**

1.  **Define the `requestUserChoice` Tool**: In `src/services/agent/agent.service.ts`, within the `initialize` method, create the new tool definition.

    ```typescript
    // In src/services/agent/agent.service.ts, inside the initialize method

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
      func: async () => 'Pausing for user choice.', // Body is a placeholder.
    });

    const allTools: DynamicStructuredTool[] = [...dynamicTools, humanTool, requestUserChoiceTool];
    ```

2.  **Update Agent Prompts**: In the same file, modify the `DEV_AGENT_PROMPT` and `PM_AGENT_PROMPT`.
    - **Remove** the lines:
      > `- After each question, you MUST provide at least two numbered options for the user to choose from.`
      > `- You MUST recommend one of the options by marking it with "(Recommended)".`
    - **Add** the following instruction:
      > `- When you need the user to make a decision, you MUST call the \`requestUserChoice\` tool. Provide a clear question and at least two distinct options. You MUST set \`isRecommended\` to true for one of the options.`

3.  **Update Graph Edges**: Modify the conditional edge from the `agent` node to handle the new tool.

    ```typescript
    // In src/services/agent/agent.service.ts, inside the initialize method

    graph.addConditionalEdges('agent', state => {
      const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
      if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        if (
          lastMessage.tool_calls.some(
            tc => tc.name === 'ask_human' || tc.name === 'requestUserChoice'
          )
        ) {
          // MODIFIED
          return 'human_in_the_loop';
        }
        return 'tools';
      }
      return END;
    });
    ```

4.  **Update Stream Logic**: In the `stream` method, update the `human_in_the_loop` block to emit the new event type.

    ```typescript
    // In src/services/agent/agent.service.ts, inside the stream() method's loop

    } else if (stepName === 'human_in_the_loop') {
      if (!stateToUse) { /* ... error handling ... */ return; }
      const lastMessage = stateToUse.messages[stateToUse.messages.length - 1] as AIMessage;

      const userChoiceToolCall = lastMessage.tool_calls?.find(tc => tc.name === 'requestUserChoice');
      if (userChoiceToolCall?.args) {
        yield { type: 'user_choice_required', content: JSON.stringify(userChoiceToolCall.args) };
        return; // Stop stream and wait for UI.
      }

      const humanQueryToolCall = lastMessage.tool_calls?.find(tc => tc.name === 'ask_human');
      if (humanQueryToolCall?.args) {
        const question = humanQueryToolCall.args.question;
        yield { type: 'human_input_required', content: question };
        return;
      }
    }
    ```

**Step 2: Modify `ChatWindow.tsx` and `OptionSelector.tsx`**

1.  **Add State for Question**: In `src/components/ChatWindow.tsx`, add state to hold the question associated with the options.

    ```typescript
    // src/components/ChatWindow.tsx
    const [optionsQuestion, setOptionsQuestion] = useState('');
    ```

2.  **Update `processStream`**: Handle the new `user_choice_required` event.

    ```typescript
    // src/components/ChatWindow.tsx, in processStream
    // ...
    } else if (chunk.type === 'user_choice_required') {
      const { question, options } = JSON.parse(chunk.content);
      const parsedOptions: ParsedOption[] = options.map((opt: any, index: number) => ({
        ...opt,
        number: index + 1,
      }));

      setOptionsQuestion(question);
      setCurrentOptions(parsedOptions);
      setShowOptions(true);
      setIsLoading(false);
      return;
    }
    // ...
    // The part of this function that calls parseAgentResponse can now be removed.
    ```

3.  **Update `handleOptionSelect`**: Change it to send `option.title` back to the agent.

    ```typescript
    // src/components/ChatWindow.tsx
    const handleOptionSelect = async (option: ParsedOption) => {
      const optionText = option.title; // MODIFIED
      setShowOptions(false);
      setOptionsQuestion(''); // Clear question state
      const userMessage: Message = { sender: 'user', content: optionText };
      // ... rest of function is the same
    };
    ```

4.  **Update Rendering**: Display the question above the `OptionSelector`.

    ```tsx
    // src/components/ChatWindow.tsx - in the JSX return
    // ...
    ) : showOptions && currentOptions.length > 0 ? (
      <Box flexDirection="column" marginY={1}>
        <Box marginBottom={1}>
          <Text bold color="yellow">
            {/* MODIFIED - Was message.parsedResponse.question */}
            {optionsQuestion}
          </Text>
        </Box>
        <OptionSelector
          options={currentOptions}
          onSelect={handleOptionSelect}
          onCancel={handleOptionCancel}
        />
      </Box>
    ) : (
    // ...
    ```

    _Note: The old location for the question inside the message history loop can be removed._

**Step 3: Refactor and Clean Up**

1.  **Simplify `response-parser.ts`**: The primary purpose of this file is now gone. You can remove all the logic related to finding and parsing options, questions, and recommendation markers. The file might still be useful for parsing a markdown title (`# Title`), but otherwise, it can be heavily simplified or removed entirely if no other component uses it.

2.  **Clean up `ChatWindow.tsx`**:
    - Remove the `parsedResponse` field from the `Message` interface.
    - Remove the call to `parseAgentResponse` at the end of the `processStream` function.
    - Remove the `agentQuestion` state variable, as its purpose is now served by `optionsQuestion`.

This plan provides a clear path to a more robust and maintainable implementation.
