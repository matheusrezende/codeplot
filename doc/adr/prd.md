### **ADR-003: Introduce a Specialized `PRDAgent` for Product-Focused Workflows**

**Date**: 2024-08-01

**Status**: Accepted

**Context**:
The application currently focuses exclusively on a developer persona, generating technical ADRs. To expand our user base to include Product Managers, the tool must be able to facilitate product-focused conversations and generate appropriate artifacts, such as a Product Requirements Document (PRD).

Mixing product and technical requirement gathering into a single agent would create a complex, monolithic component with confusing conditional logic, making it difficult to maintain and test. A clear separation of concerns is needed to manage the distinct conversational flows and output formats for each persona.

**Decision**:
We will implement a new, specialized agent, the `PRDAgent`, dedicated to handling the product discovery and PRD generation workflow.

1.  **`PRDAgent` Creation**: A new `PRDAgent` class will be created. It will have its own system prompt and logic tailored for gathering product requirements (e.g., problem statement, user personas, success metrics, user stories, functional requirements). It will use the same tool-use capabilities (MCP) as the `PlanningAgent` to gather context.
2.  **`PRDGeneratorAgent` Creation**: A corresponding `PRDGeneratorAgent` will be created. Its sole responsibility will be to take a completed conversation history from the `PRDAgent` and synthesize it into a well-structured PRD.
3.  **Workflow Selection**: The application will prompt the user at the beginning of a new session to choose their desired workflow or "persona."
    - **Prompt to User**: "What would you like to create? \n 1. An Architecture Decision Record (for developers) \n 2. A Product Requirements Document (for product managers)"
4.  **`AgentOrchestrator` Update**: The `AgentOrchestrator` will be refactore/d to manage the different workflows. Based on the user's initial choice, it will instantiate and delegate to the appropriate set of agents (`PlanningAgent` + `ADRGeneratorAgent` OR `PRDAgent` + `PRDGeneratorAgent`).

**Consequences**:

- **Positive**:
  - **Clear Separation of Concerns**: Each agent has a single, well-defined responsibility. The `PlanningAgent` remains focused on technical planning, while the `PRDAgent` focuses on product discovery.
  - **Improved Maintainability**: The logic for each persona is isolated, making it easier to debug, modify, and improve each workflow independently.
  - **Enhanced Testability**: The new agents can be unit-tested in isolation.
  - **Better User Experience**: The conversational flow will be tailored to the user's role, asking more relevant questions.

- **Negative**:
  - **Increased Number of Classes**: Introduces two new agent classes to the codebase.
  - **Initial Setup Complexity**: The `AgentOrchestrator` will have slightly more complex logic for selecting and managing the active workflow.

**Rejected Alternatives**:

- **Add a "Persona" Mode to `PlanningAgent`**: Rejected because it would lead to a single, bloated agent with complex internal state management and intertwined logic, violating the Single Responsibility Principle.
- **Generic Planning, Specialized Generator**: Rejected because the _questions_ asked during the planning phase need to be different for each persona. A generic planning phase would be too vague to produce a high-quality PRD or ADR without significant follow-up, leading to a poor user experience.

---

### **Implementation Plan**

**Step 1: Define PRD Structure and Create `PRDAgent`** ✅

1.  **Define `PRD` and `PRDSection` Types**: In `src/types/prd.ts`, define the structure for our PRD output. ✅

    ```typescript
    export interface PRDSection {
      title: string;
      content: string;
    }

    export interface PRD {
      title: string;
      sections: PRDSection[];
    }
    ```

2.  **Create `src/agents/PRDAgent.ts`**: ✅
    - Mirror the structure of `PlanningAgent.ts`.
    - Use the DI container (`@injectable()`).
    - Create a new system prompt focused on product discovery. It should guide the AI to ask about problems, goals, metrics, personas, and user stories. It should also encourage the use of MCP tools to find existing documentation.
    - The agent's methods (`askQuestion`, `evaluateReadiness`) will be similar in signature to the `PlanningAgent` but will have their own implementation.

**Step 2: Create `PRDGeneratorAgent`** ✅

1.  **Create `src/agents/PRDGeneratorAgent.ts`**: ✅
    - This will be a simple agent, similar to `ADRGeneratorAgent`.
    - It will have one primary method: `generatePRD(conversationHistory: ConversationItem[]): Promise<PRD>`.
    - Its prompt will instruct the AI to synthesize the provided conversation into a structured PRD with sections like "Problem Statement," "Goals," "User Stories," etc.
    - It should return a structured `PRD` object, not just a markdown string.

**Step 3: Update `AgentOrchestrator` to Support Workflows** ✅

1.  **Introduce a `WorkflowType`**: ✅
    ```typescript
    // src/agents/AgentOrchestrator.ts
    export type WorkflowType = 'adr' | 'prd';
    ```
2.  **Refactor Constructor and Methods**: ✅
    - The orchestrator will no longer directly inject `PlanningAgent` and `ADRGeneratorAgent`. Instead, it will inject a factory or the DI container itself to resolve agents on demand.
    - A new method `setWorkflow(type: WorkflowType)` will be added. This will control which agents are used for the session.
    - Methods like `startPlanning` and `generateDocument` will use conditional logic based on the active workflow to call the correct agent (`PlanningAgent` or `PRDAgent`).

**Step 4: Update UI for Workflow Selection** ✅

1.  **Modify `App.jsx` or `ChatView.jsx`**: ✅
    - At the start of a new session, before the first question is asked, the UI must present the user with the choice of workflow.
    - A new state, e.g., `awaiting_workflow_selection`, can be added to the state machine.
    - Once the user chooses, the UI will call `agentOrchestrator.setWorkflow('prd')` (for example) before proceeding.

**Step 5: Register New Agents in DI Container** ✅

1.  **Update `src/container.ts`**: ✅
    - Register the new `PRDAgent` and `PRDGeneratorAgent` so they can be resolved by the `AgentOrchestrator`.

This plan fully outlines the creation of the product manager workflow. All implementation steps are now complete.
