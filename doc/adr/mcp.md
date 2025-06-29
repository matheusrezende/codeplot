### **ADR-002: Implement AI Tool-Use via Model-Context Protocol (MCP)**

**Date**: 2024-08-01

**Status**: Accepted

**Context**:
The application needs to expand its capabilities beyond analyzing a local codebase. To support Product Manager workflows, it must interact with external knowledge sources like Notion and Confluence to read requirements and write documents (PRDs). Building and maintaining bespoke API clients for each external service is not scalable, would introduce significant complexity, and tightly couples our application to their specific API designs.

The **Model-Context Protocol (MCP)** provides a standardized interface for AI models to fetch context from such services. By adopting MCP, we can delegate the service-specific logic to external MCP servers, which the user can configure.

**Decision**:
We will refactor the application to become a generic MCP client and integrate it into our agent architecture as a "tool" the AI can use.

1.  **MCP Client Implementation**: We will create a generic `MCPClient` class responsible for making authenticated requests to any MCP-compliant server.
2.  **Configuration System**: We will implement a configuration loader that reads a `mcp-config.jsonc` file from the project's `.codeplot/` directory and/or a global user directory. This file will allow users to define a list of MCP servers they want the AI to be able to use.
    - **Schema for `mcp-config.jsonc`**:
      ```jsonc
      {
        "servers": [
          {
            // A user-friendly ID for this connection
            "id": "work_notion",
            // A description for the AI to understand what this tool is for
            "description": "Searches the company's Notion workspace for PRDs, documentation, and project plans.",
            // The base URL of the MCP server
            "baseUrl": "https://mcp.notion.com/v1", // Example URL
            // Authentication details
            "auth": {
              "type": "env", // Currently supporting env variables
              "variable": "NOTION_API_KEY",
            },
          },
          {
            "id": "atlassian_jira",
            "description": "Fetches and searches for tickets, epics, and user stories in the Atlassian Jira instance.",
            "baseUrl": "https://mcp.atlassian.net/v1", // Example URL
            "auth": {
              "type": "env",
              "variable": "JIRA_API_TOKEN",
            },
          },
        ],
      }
      ```
3.  **AI Tool-Use Integration**: The `AgentOrchestrator` will dynamically create "tools" from the loaded MCP configurations. These tools (e.g., `search_work_notion`, `get_content_from_atlassian_jira`) will be made available to the `PlanningAgent`. The agent's underlying prompt and logic will be updated to support a tool-use/function-calling paradigm, allowing it to decide when to query these external services for information.

**Consequences**:

- **Positive**:
  - **Extreme Extensibility**: Adding support for a new service (e.g., Figma, Linear) is as simple as the user adding a new entry to their config file, provided an MCP server exists for it. No code changes are needed in our application.
  - **Reduced Maintenance**: We are no longer responsible for tracking the API changes of dozens of external services. We only need to maintain compatibility with the MCP standard.
  - **Enhanced AI Capabilities**: The AI can actively seek information during the planning phase, leading to much more informed and context-aware outputs (PRDs and ADRs).
  - **User Control**: Users have full control over which data sources the AI can access and how they are authenticated.

- **Negative**:
  - **User Responsibility**: The user is now responsible for hosting or having access to an MCP server for the services they want to use. This adds a setup step for the user.
  - **Protocol Dependency**: The application is now dependent on the MCP specification and its ecosystem.
  - **Increased Complexity in Agent Logic**: The agents must be refactored to handle the asynchronous, multi-step process of deciding to call a tool, executing it, and processing the result.

**Rejected Alternatives**:

- **Bespoke API Clients**: Rejected because it is not scalable and leads to high maintenance overhead.
- **Third-Party Integration Platforms (e.g., Zapier)**: Rejected because MCP is a more open, standardized, and purpose-built protocol for this exact use case, offering more control and avoiding platform lock-in.

---

### **Implementation Plan**

**Step 1: MCP Configuration Management** ✅

1.  **Create `src/config/MCPConfigManager.ts`**: ✅
    - This class will be responsible for finding, loading, and validating `mcp-config.jsonc` files.
    - It should look for `.codeplot/mcp-config.jsonc` in the current project directory.
    - (Future) It could also look in a global user directory (e.g., `~/.config/codeplot/mcp-config.jsonc`) and merge the configurations.
    - It will have a public method `loadActiveServers(): MCPSeerverConfig[]`.
2.  **Define Types**: Create `src/types/mcp.ts` to hold the interfaces for `MCPServerConfig`, `MCPAuth`, etc. ✅
3.  **DI Registration**: Register `MCPConfigManager` as a singleton in `src/container.ts`. ✅

**Step 2: Generic MCP Client** ✅

1.  **Create `src/clients/MCPClient.ts`**: ✅
    - This class will take an `MCPServerConfig` in its constructor.
    - It will have methods that map to the MCP standard, like `search(query: string): Promise<MCP_SearchResponse>` and `getContent(id: string): Promise<MCP_ContentResponse>`.
    - It will handle fetching the auth token from the environment variable specified in the config and adding the `Authorization` header.
    - It will use a library like `axios` or the native `fetch` API for HTTP requests.
    - It needs robust error handling for network issues or non-200 responses.

**Step 3: AI Tool Abstraction** ✅

1.  **Refactor `AgentOrchestrator` to manage tools**: ✅
    - Inject `MCPConfigManager`.
    - In its initialization, it will call `mcpConfigManager.loadActiveServers()`.
    - It will loop through the server configs and create a dynamic "tool" for each one. We can use LangChain's `DynamicTool` or a similar abstraction.
    - Each tool needs a `name` (e.g., `search_work_notion`) and the `description` from the config file, which is crucial for the AI to know when to use it.
    - The tool's function will instantiate `MCPClient` with the appropriate config and call the relevant method (e.g., `search`).

**Step 4: Refactor `PlanningAgent` for Tool-Use** ✅

1.  **Update `PlanningAgent.askQuestion`**: ✅
    - The method signature will now accept an array of tools: `askQuestion(..., tools: BaseTool[])`.
    - The LangChain model invocation will be updated to bind these tools. Example: `this.model.bindTools(tools)`.
2.  **Update Prompt**: The system prompt for the `PlanningAgent` needs to be updated to explicitly encourage it to use the provided tools to gather information before asking questions. ✅
3.  **Handle Tool Calls**: The agent's logic must now be a loop. After calling the model, it must check if the response is a tool call or a message to the user. ✅
    - If it's a tool call, the `AgentOrchestrator` will execute the tool and send the results back to the agent for another iteration. ✅
    - If it's a message, it gets displayed to the user as before. ✅

This plan establishes a powerful, scalable framework for external integrations. All implementation steps are now complete.
