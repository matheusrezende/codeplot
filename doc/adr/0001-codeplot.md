### Architecture Decision Record (ADR)

**Title:** 001 - Core Application Architecture

**Date:** 2025-06-29

**Status:** Accepted

**Context:**
The goal is to create `codeplot`, an interactive, agent-powered CLI for software development tasks like feature planning and ADR generation. The application must be modular, extensible, and testable, following Clean Architecture principles. It needs to provide AI agents with a flexible way to interact with tools and codebase context. Key requirements include a robust logging system for debugging, a flexible configuration mechanism, and a clear user interface for selecting different agent personas (e.g., PM vs. Developer).

**Decision:**
We will build `codeplot` based on the following architectural pillars:

1.  **Primary Identity:** `codeplot` is an **agent-powered CLI application**. Its core purpose is to orchestrate AI agents to perform tasks.

2.  **Architecture Pattern:** We will implement a **Clean Architecture** using **Dependency Injection (DI)** with the `tsyringe` library. This ensures services are decoupled and independently testable.

3.  **Tool Integration:** The application will function as an **MCP (Model Context Protocol) Client**. It will not contain business logic for tools itself. Instead, it will connect to external, user-configured MCP servers (e.g., Repomix, Context7). The `codeplot` agent will be provided with a list of all tools available from these servers and will decide which ones to call during a session.

4.  **Configuration:** A hierarchical configuration system will be used to define the MCP servers:
    - **Global Config:** A base configuration file at `~/.codeplot/mcp-config.json`.
    - **Project Config:** An optional override file at `./.codeplot/mcp-config.json`.
    - **Merge Strategy:** We will use an **"Extend and Override"** strategy. The project configuration is layered on top of the global one. Servers with the same name in the project config replace their global counterparts, and new servers are added to the list.

5.  **Logging:** A centralized `LoggerService` will be built using the **`winston`** library.
    - **Transports:** It will be configured with two transports:
      1.  A human-readable, colorized **Console Transport**.
      2.  A structured JSON **File Transport** (`winston-daily-rotate-file`) for detailed, persistent logs in `~/.codeplot/logs/`.
    - **Control:** A global `--debug` CLI flag will dynamically set the Console transport's log level to `debug` for increased verbosity.

6.  **User Interaction:**
    - An initial **menu selection** (using `ink`) will allow the user to choose the desired agent persona (e.g., "Developer Agent" or "PM Agent") at the start of a session.

**Consequences:**

- **Pros:**
  - **Extensibility:** The MCP client model allows users to integrate any compatible tool without changes to `codeplot` itself.
  - **Testability & Maintainability:** The combination of Clean Architecture, DI, and service-based design (Logger, Config, MCP Client) makes the application highly modular and easy to test and maintain.
  - **Robustness:** The centralized logging service provides excellent debugging capabilities, and the hierarchical configuration is both powerful and user-friendly.
  - **Clarity:** Separating concerns makes the codebase easier to understand and navigate.
- **Cons:**
  - **Initial Complexity:** The initial setup requires creating the DI container, service interfaces, and multiple service implementations (Logger, Config, MCP Client).
  - **External Dependencies:** The application's utility is dependent on users having external MCP servers installed and configured correctly.
  - **Added Dependencies:** The project will add `tsyringe`, `winston`, `commander`, and MCP-related packages.

**Rejected Alternatives:**

- **Internal Tools:** Building tools directly into `codeplot` was rejected as it's inflexible and tightly coupled.
- **Simplified Configuration:** Using a single global config file or environment variables was rejected in favor of the more powerful and conventional hierarchical approach.
- **"Full Override" Config:** Having the project config completely replace the global config was rejected as it provides a poor user experience.
- **Alternate Logging Libraries:** `pino` was considered but `winston` better suits the need for multiple, differently-formatted outputs. A custom logger was rejected as it would require reinventing features already available in `winston`.
- **Alternate Agent Selection:** Using a "meta-agent" or slash commands for switching was rejected in favor of a clearer, upfront menu selection.

---

### Step-by-Step Implementation Plan

This is a unified plan to build the foundational framework incorporating all the decisions above.

#### **Step 1: Project Setup and Dependencies**

_Goal: Install all necessary packages and establish the project structure and DI container._

1.  **Install Dependencies:**
    ```bash
    npm install tsyringe reflect-metadata winston winston-daily-rotate-file commander ink ink-select-input
    npm install @types/ink -D
    ```
2.  **Create Directory Structure:**
    - `src/services/logger/`
    - `src/services/config/`
    - `src/services/mcp/`
    - `src/services/agent/`
    - `src/components/` (for Ink UI components)
3.  **Define All Core Interfaces:**
    - Create `src/services/logger/logger.interface.ts` (with `ILoggerService`).
    - Create `src/services/config/config.interface.ts` (with `IConfigService`).
    - Create `src/services/mcp/mcp.interface.ts` (with `IMcpService`).
4.  **Setup DI Container:**
    - In `src/index.ts`, add `import 'reflect-metadata';` as the very first line.
    - Create `src/container.ts` to configure and export the `tsyringe` container.

#### **Step 2: Implement the Centralized LoggerService**

_Goal: Create a robust, injectable logging service._

1.  **Implement `LoggerService`:**
    - In `src/services/logger/logger.service.ts`, create the `LoggerService` class implementing `ILoggerService`.
    - The constructor will configure `winston` with Console and `DailyRotateFile` transports. The console level will be determined by the presence of a `--debug` flag in `process.argv`.
2.  **Register in DI Container:**
    - In `src/container.ts`, register `LoggerService` as a singleton for the `ILoggerService` token.

#### **Step 3: Implement the Hierarchical ConfigService**

_Goal: Load and merge global and project-specific configurations._

1.  **Define Schemas:**
    - Create `src/services/config/config.schema.ts` to define the `McpConfig` and `McpServer` types.
2.  **Implement `ConfigService`:**
    - In `src/services/config/config.service.ts`, create the `ConfigService` class.
    - Inject `ILoggerService` into its constructor.
    - Implement the `loadConfig()` method to read the global and project files, log its progress, and apply the "Extend and Override" logic.
3.  **Register in DI Container:**
    - In `src/container.ts`, register `ConfigService` for the `IConfigService` token.

#### **Step 4: Implement the MCP Client Service**

_Goal: Manage the lifecycle of MCP servers and discover their tools._

1.  **Implement `McpService`:**
    - In `src/services/mcp/mcp.service.ts`, create the `McpService` class.
    - Inject both `ILoggerService` and `IConfigService`.
    - Implement a `connect()` method that gets the config from the `ConfigService`, then uses `child_process.spawn` to start each enabled server. It should log all lifecycle events (starting, connected, error).
    - Implement tool discovery (`listTools`) and storage.
    - Implement `callTool` to dispatch requests to the correct child process.
2.  **Register in DI Container:**
    - Register `McpService` in `src/container.ts`.

#### **Step 5: Create the Main Application Entrypoint**

_Goal: Wire everything together and create the initial UI flow._

1.  **Refactor `src/index.ts`:**
    - Use `commander` to define the `plan` command and the global `--debug` option.
    - In
