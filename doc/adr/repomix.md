### **ADR-004: Refactor Repo Packing into a Dynamic AI Tool**

**Date**: 2024-08-01

**Status**: Accepted

**Context**:
Currently, the application packs the entire repository using `repomix` at the very beginning of a session. This process is static and mandatory. The AI has no control over it. As the application becomes more sophisticated, the AI might need to:

1.  Analyze the codebase only if the user's request requires it (e.g., a pure product strategy question may not need code context).
2.  Re-analyze the codebase if the user mentions that code has changed during the session.
3.  Analyze a specific subdirectory for a more focused view.

The current implementation does not support this dynamic behavior. To enhance the AI's capabilities, codebase analysis should be a tool it can choose to use, rather than a prerequisite for all interactions.

**Decision**:
We will refactor the `RepoPackager` to function as a callable AI tool.

1.  **Remove Automatic Packing**: The mandatory, upfront call to `repoPackager.pack()` in the `SessionStateMachine` will be removed. The application will start without any initial codebase analysis.
2.  **Create a `CodebaseAnalysisTool`**: We will create a new tool that wraps the `RepoPackager`. This tool will be made available to all relevant agents (`PlanningAgent`, `PRDAgent`).
    - **Tool Definition**: The tool will be named `analyze_codebase`.
    - **Tool Description**: The description provided to the AI will be critical. It will say something like: "Analyzes the project's codebase structure, dependencies, and file contents to provide technical context. Use this tool if the user's request involves changing, adding to, or understanding the existing code. You can optionally provide a subdirectory path to focus the analysis."
    - **Tool Parameters**: The tool's function will accept an optional `path` parameter (e.g., `{ path: 'src/services' }`). If no path is provided, it will analyze the entire project.
3.  **Update Agent Prompts**: The system prompts for both the `PlanningAgent` and the `PRDAgent` will be updated to make them aware of this new tool. The prompt will explicitly state that if technical context is needed to answer a question or formulate a plan, the `analyze_codebase` tool should be called first.
4.  **Manage Codebase Context**: The output of the tool (the packed codebase string) will be added to the conversation history as "tool output." This ensures it is included in the context for subsequent AI calls. The `AgentOrchestrator` will be responsible for managing this context.

**Consequences**:

- **Positive**:
  - **Increased AI Autonomy**: The AI can now make an informed decision about when it needs technical context, leading to more efficient and relevant interactions.
  - **Faster Session Startup**: Sessions that don't require code analysis will start instantly, without the delay of running `repomix`.
  - **Dynamic Re-analysis**: The AI can choose to re-scan the codebase mid-conversation if needed.
  - **Architectural Consistency**: Treats codebase analysis as just another "tool," aligning with the MCP integration design.

- **Negative**:
  - **Potential for Initial Delay**: The first user interaction that requires code analysis will have a delay while `repomix` runs, which was previously handled at startup. This is a trade-off for overall flexibility.
  - **More Complex Prompts**: The system prompts for the agents become more complex as they need to guide the AI on when to use this tool.
  - **Context Window Management**: Large codebase outputs can consume a significant portion of the AI's context window. We must be mindful of this when managing the conversation history.

**Rejected Alternatives**:

- **Keep Static Upfront Packing**: Rejected because it's inflexible and doesn't align with the goal of making the AI more autonomous and context-aware.
- **User-Triggered Packing**: Having the user manually trigger a re-pack via a command (e.g., `/repack`) is less elegant than allowing the AI to request it automatically when it detects the need.

---

### **Implementation Plan**

**Step 1: Abstract `RepoPackager` into a Tool**

1.  **Refactor `RepoPackager.pack`**: Ensure the `pack` method can accept an optional `subDirectory` argument.
    ```typescript
    // src/repo-packager.ts
    export class RepoPackager {
      // ...
      async pack(subDirectory?: string): Promise<PackResult> {
        const targetPath = subDirectory
          ? path.join(this.projectPath, subDirectory)
          : this.projectPath;
        // Update the exec command to use targetPath
        // ...
      }
    }
    ```
2.  **Create the Tool in `AgentOrchestrator`**:
    - Similar to how MCP tools are created, the `AgentOrchestrator` will create the `analyze_codebase` tool.
    - Inject `RepoPackager`.
    - Use LangChain's `DynamicTool` or a similar abstraction.

    ```typescript
    // src/agents/AgentOrchestrator.ts
    import { DynamicTool } from '@langchain/core/tools';

    // Inside a method that sets up tools
    const repoTool = new DynamicTool({
      name: 'analyze_codebase',
      description:
        'Analyzes the project codebase to provide technical context. Use this if the request involves changing or understanding existing code. Optionally provide a `path` argument to scan a specific subdirectory.',
      func: async ({ path }: { path?: string }) => {
        const packResult = await this.repoPackager.pack(path);
        // Return a summary and the content
        return `Analysis Summary:\n${JSON.stringify(packResult.summary, null, 2)}\n\nCodebase Content:\n${packResult.content}`;
      },
      // Define the schema for the tool's input
      schema: z.object({ path: z.string().optional() }),
    });
    this.tools.push(repoTool);
    ```

**Step 2: Remove Static Packing Logic**

1.  **Modify `SessionStateMachine.ts`**:
    - Locate the `transitionTo(this.states.CODEBASE_PACKED)` logic in `executeTransition`.
    - Remove the call to `this.packCodebase()`. The state transition can be removed or repurposed. The concept of a "packed" state is no longer a mandatory step. The `App.jsx` UI will also need to be updated to remove the "Packing repository..." status message at startup.
2.  **Update `App.jsx`**:
    - Remove the `useEffect` logic and state variables related to displaying the `repomixSummary` during initialization (`InitializationView`). The UI will now transition directly to the chat view.

**Step 3: Update Agent Prompts**

1.  **Modify `PlanningAgent` and `PRDAgent` Prompts**:
    - Add instructions to the system prompt of both agents.
    - Example addition: "You have access to a tool called `analyze_codebase`. If the user's request requires knowledge of the existing software architecture, file structure, or code, you must call this tool first to gather context before providing an answer or asking clarifying questions."

**Step 4: Manage Code Context in `AgentOrchestrator`**

1.  **Handle Tool Output**:
    - The `AgentOrchestrator`'s main conversation loop already needs to handle tool calls and results for MCP. The same logic will now apply to the `analyze_codebase` tool.
    - When the tool returns the packed codebase, the orchestrator must add this large string to the conversation history as the tool's output.
    - Subsequent calls to the AI will include this context, allowing it to answer the user's original query.

This completes the plan to make codebase analysis a dynamic, AI-driven tool. What is the final piece of your initial request we should address?
