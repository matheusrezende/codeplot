### **Architecture Decision Record (ADR)**

**Title:** UI/UX Improvement: Real-time Feedback and Agent Response Streaming

**1. Context**

The current command-line interface (CLI) feels static. When a user sends a message, the application displays a "Thinking..." message and provides no further feedback until the agent's full response is ready. Intermediate steps, such as tool calls, are logged directly into the chat history, cluttering the conversational record. This makes the application feel slow and less interactive. We need to provide better real-time feedback to the user and make the agent's responses stream in as if they are being typed live.

**2. Decision**

We will implement the following changes, focusing on isolating UI logic within the frontend component (`ChatWindow.tsx`):

- **Dedicated Status Indicator:** A new status area will be implemented to show the agent's current activity. This will replace the simple "Thinking..." message and will be capable of displaying both a general status (e.g., "Thinking...") and specific, transient details about ongoing operations (e.g., "Calling tool: pack_codebase").
- **Clean Conversational History:** The chat history will be strictly reserved for `user` and `agent` messages. All intermediate "thought" and "tool_call" events from the agent service will be consumed by the new status indicator, not added to the history.
- **Client-Side Response Streaming:** To avoid deep, complex changes in the backend agent service (`agent.service.ts`), we will simulate the response streaming effect on the client side. When `ChatWindow.tsx` receives a complete agent message, it will render it incrementally (word-by-word) to the user, providing the desired "live typing" effect without re-architecting the LangGraph implementation.

**3. Rejected Alternatives**

- **Backend-Driven True Streaming:**
  - _Description:_ Modify `agent.service.ts` and the LangGraph setup to use the model's native `.stream()` capability, yielding individual tokens to the client.
  - _Reason for Rejection:_ This would add significant complexity to the `StateGraph` logic, which is designed around discrete state transitions, not streaming tokens from within a graph node. The client-side simulation achieves an identical user-facing result with far less complexity and risk, adhering to our preference for clarity and modularity.
- **Keep Thoughts in History with Different Styling:**
  - _Description:_ Retain the "thought" messages in the history but style them differently (e.g., with a different color or icon) to distinguish them from the main conversation.
  - _Reason for Rejection:_ This does not fully address the goal of a clean, conversational log. The user explicitly requested removing these messages. The new dedicated status indicator provides a less intrusive and more effective way to convey this information.

**4. Consequences**

- **Positive:**
  - **Enhanced User Experience:** The application will feel significantly more responsive, transparent, and interactive.
  - **Improved Clarity:** The chat history will become a clean, easy-to-read record of the core conversation.
  - **Low Implementation Risk:** By isolating changes to the `ChatWindow.tsx` component, we minimize the risk of introducing bugs into the core agent and service logic.
- **Negative:**
  - **Simulated Streaming:** The streaming is a client-side effect. For an unusually long agent response, there might be a brief delay between the "Thinking..." indicator disappearing and the text stream beginning. This is an acceptable trade-off for the vast reduction in implementation complexity.
  - **UI-Only Verbosity:** Detailed logs of agent thoughts will no longer be visible in the UI. This is the desired behavior, and this information remains available in the file-based logs for debugging purposes.

---

### **Implementation Plan**

This plan breaks the work into small, shippable steps focused on the `ChatWindow.tsx` component.

**Step 1: Refactor State and Create a New Loading/Status Indicator**

The goal of this step is to replace the simple `isLoading` boolean and `LoadingIndicator` with a more robust state management system for displaying the agent's status.

**File to Modify:** `src/components/ChatWindow.tsx`

1.  **Update State Variables:**
    - Remove the `LoadingIndicator` component entirely.
    - Introduce a new state to manage detailed loading status. This will replace the simple `isLoading` text.

    ```tsx
    // Add this new state
    const [statusText, setStatusText] = useState('');

    // This existing state will now primarily control the input box visibility
    const [isLoading, setIsLoading] = useState(false);
    ```

2.  **Update Rendering Logic:**
    - Locate the JSX where `LoadingIndicator` is currently rendered:
      ```tsx
      {
        isLoading && (
          <Box marginLeft={3}>
            <Text color="gray">
              <LoadingIndicator />
            </Text>
          </Box>
        );
      }
      ```
    - Replace it with a new block that renders the `statusText`. This new block will serve as our persistent status display during agent activity.

    ```tsx
    // New JSX to render the status
    {
      isLoading && statusText && (
        <Box marginLeft={3} flexDirection="column">
          <Text color="gray">{statusText}</Text>
        </Box>
      );
    }
    ```

**Step 2: Update Stream Processing to Control the New Status Indicator**

Now, we'll modify the `processStream` function to populate our new status indicator and clean up the chat history.

**File to Modify:** `src/components/ChatWindow.tsx`

1.  **Modify `processStream` function:**
    - Locate the `for await (const chunk of stream)` loop.
    - **Remove History Pollution:** Delete the code blocks that handle `chunk.type === 'thinking'` and `chunk.type === 'tool_call'`. These currently add "thought" messages to the history.
    - **Implement New Status Updates:** Add new logic at the top of the loop to handle status updates.

    ```typescript
    // Inside processStream function
    let currentToolCall = '';
    for await (const chunk of stream) {
      if (chunk.type === 'thinking') {
        setStatusText('Thinking...');
      } else if (chunk.type === 'tool_call') {
        currentToolCall = chunk.content;
        setStatusText(`Thinking...\n  └ ${currentToolCall}`);
      } else if (chunk.type === 'agent') {
        // This part will be updated in the next step
        // For now, let's just clear the status
        setStatusText('');
        currentToolCall = '';

        // The rest of the existing agent chunk logic...
        // ...
      }
      // ... handle other chunk types like human_input_required
    }
    // At the end of the stream, clear the status text
    setStatusText('');
    setIsLoading(false);
    ```

2.  **Modify `handleSumbit` function:**
    - In the `handleSumbit` function, set the initial status when a request starts.

    ```typescript
    // Inside handleSumbit, before calling agentService.stream
    setIsLoading(true);
    setShowOptions(false);
    setStatusText('Sending request...'); // Initial status
    const stream = agentService.stream(input, threadId);
    ```

**Step 3: Implement Client-Side "Live Typing" for Agent Responses**

This is the final step, where we implement the word-by-word streaming effect for the agent's messages.

**File to Modify:** `src/components/ChatWindow.tsx`

1.  **Update the `agent` chunk handler in `processStream`:**
    - Replace the entire existing `else if (chunk.type === 'agent')` block with the new logic below. This logic first clears the status indicator, then adds a new, empty agent message to the history, and finally "types out" the response into that message.

    ```typescript
    // Replace the existing 'agent' block in processStream with this:
    } else if (chunk.type === 'agent') {
      setStatusText(''); // Clear the "Thinking..." status
      currentToolCall = '';
      setIsLoading(true); // Keep loading state to disable input

      let agentMessageIndex = -1;
      // Add a placeholder for the agent's message
      setHistory(prev => {
        const newHistory = [...prev, { sender: 'agent', content: '' }];
        agentMessageIndex = newHistory.length - 1;
        return newHistory;
      });

      // Simulate typing word-by-word
      const words = chunk.content.split(' ');
      let currentContent = '';
      for (const word of words) {
        currentContent += (currentContent ? ' ' : '') + word;
        setHistory(prev => {
          const newHistory = [...prev];
          if (newHistory[agentMessageIndex]) {
            newHistory[agentMessageIndex].content = currentContent;
          }
          return newHistory;
        });
        await new Promise(resolve => setTimeout(resolve, 60)); // 60ms delay between words
      }

    } else if (chunk.type === 'human_input_required') { // Make sure to keep other handlers
    // ...
    ```

2.  **Finalize State Updates:**
    - At the very end of the `processStream` function, ensure `setIsLoading` is set to `false` to re-enable the user input box.

    ```typescript
    // At the end of processStream
    setIsLoading(false);
    setStatusText('');
    ```

By following these steps, the application's UI will be significantly improved to provide the requested real-time feedback and a cleaner, more professional user experience.
