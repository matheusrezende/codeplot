Of course. Based on our conversation, here is the comprehensive Architecture Decision Record.

# ADR: 0006 - Adopt File-Based Session Persistence for Resumable Conversations

## Status

Proposed

## Context

The `codeplot` CLI tool is currently stateless. Each `codeplot plan` execution starts a new, isolated conversation with the AI. If a user is interrupted, closes the terminal, or wishes to refine a feature over multiple sessions, all conversational context and planning progress is lost. This limitation makes the tool impractical for complex features that require more than a single session to define. We need a mechanism to persist and resume conversations.

## Decision

We will implement a file-based session persistence system.

1.  **Storage:** A new directory, `.codeplot/sessions/`, will be created in the root of the user's project to store session files.
2.  **Session Format:** Each conversation will be saved as a separate JSON file (e.g., `user-authentication.json`). The file will contain a single JSON object with two top-level keys:
    - `featureData`: An object containing application-specific state like the feature name, requirements, and ADR content.
    - `chatHistory`: An array of objects representing the full conversation history, compatible with the Gemini API.
3.  **User Flow:**
    - The `plan` command will be enhanced with a new `--session <path>` flag to directly load a specific session file.
    - If the flag is not used, the tool will scan the `.codeplot/sessions/` directory and present an interactive menu to the user:
      - The first option will always be "Start a new feature plan".
      - Subsequent options will be a list of existing sessions that can be resumed.
4.  **Data Integrity:** The session state will be written to its corresponding JSON file after every user response during the interactive planning phase. This ensures minimal data loss in case of an error or interruption.

## Consequences

- **Positive:**
  - Users can now safely plan complex features across multiple sessions without losing progress.
  - Conversations are preserved even after an ADR is generated, allowing users to revisit, refine, and regenerate the ADR.
  - The `.codeplot/` directory establishes a clear, project-specific workspace for all tool-related artifacts.
- **Negative:**
  - File I/O will increase, as a write operation occurs after each user turn. (This is considered a negligible performance impact for a CLI tool).
  - A new `.codeplot/` directory will be created in the user's project, which should be added to the project's `.gitignore` file to avoid committing session data.
  - The startup logic for the `plan` command becomes more complex.

## Implementation Plan

1.  **Project Setup & Configuration:**
    - **File:** `.gitignore`
    - **Change:** Add `.codeplot/` to prevent committing session files.
    - **File:** `src/index.js`
    - **Change:** Add a new `--session <path>` option to the `plan` command.

2.  **Create `SessionManager` Module:**
    - **File:** `src/session-manager.js` (New)
    - **Change:** Create a new class `SessionManager` to handle all file-based session logic: `ensureSessionsDir`, `listSessions`, `loadSession`, `saveSession`, and `promptUserForSession`.

3.  **Integrate `SessionManager` into `FeatureArchitect`:**
    - **File:** `src/feature-architect.js`
    - **Change:**
      - Import `SessionManager`.
      - In the `start()` method, use `SessionManager` to handle the new user flow: check for the `--session` flag, otherwise prompt the user with a list of sessions or to start a new one.
      - Pass the loaded session data (or `null`) to `ChatSession`.

4.  **Make `ChatSession` State-Aware:**
    - **File:** `src/chat-session.js`
    - **Change:**
      - Modify `initialize(codebaseContent, sessionData = null)`: If `sessionData` is provided, load the `featureData` and `chatHistory` from it instead of starting a new analysis.
      - Modify `conductFeaturePlanning(sessionManager, sessionName)`:
        - If it's a new session, get a `sessionName` from the initial feature description.
        - In the main Q&A loop, after each user response, call `sessionManager.saveSession()` with the current `featureData` and `chatHistory`.

5.  **Add Unit Tests:**
    - **File:** `src/__tests__/session-manager.test.js` (New)
    - **Change:** Add tests for the `SessionManager`, mocking `fs-extra` and `inquirer`.
    - **File:** `src/__tests__/chat-session.test.js`
    - **Change:** Add tests to verify `initialize` correctly handles both new and resumed sessions.

## Alternatives Considered

- **Single Project-wide Session:** A simpler alternative where only one conversation was stored per project. It was rejected because the requirement was to manage multiple, distinct feature plans simultaneously.
- **Database Storage (e.g., SQLite):** Using a lightweight database was considered but rejected as being overly complex for the current needs. A simple file-based system is more transparent, easier for the user to manage, and avoids introducing new runtime dependencies.
- **Saving Only on Completion:** This approach was rejected because it posed a significant risk of data loss if the session was interrupted before the user explicitly finished. The chosen approach prioritizes data safety over minimizing file writes.
