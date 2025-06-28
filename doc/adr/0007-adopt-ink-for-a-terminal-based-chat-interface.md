Of course. Based on our conversation, here is the comprehensive Architecture Decision Record.

# ADR: 0007 - Adopt `ink` for a Terminal-Based Chat Interface

## Status

Proposed

## Context

The current user interaction model is a simple, sequential question-and-answer flow that prints to the standard output. This can lead to a cluttered terminal and lacks the feel of a dedicated interactive application. The goal is to create a more contained, immersive "floating window" experience, similar to modern AI chat interfaces. This requires a library capable of creating and managing a Terminal User Interface (TUI).

## Decision

We will adopt the **`ink`** library to build and manage the new interactive chat interface.

1.  **UI Component:** The initial implementation will feature a single, bordered chat box rendered by `ink`. This box will contain the scrollable conversation history.
2.  **Input Handling:** A dedicated input field will be rendered at the bottom of the chat box for user responses.
3.  **Decoupling Logic:** The `ChatSession` module, which currently handles both AI communication and terminal I/O (via `inquirer`, `ora`, `console.log`), will be refactored. Its presentation logic will be removed, and it will be responsible solely for managing chat state and communicating with the AI.
4.  **UI Module:** A new `src/ui/` directory will be created to house all `ink`/`react` components.

## Consequences

- **Positive:**
  - The user experience will be significantly improved, feeling more like a polished, modern application.
  - Using `ink`'s declarative, component-based model (React) will make the UI code more modular, readable, and easier to maintain and extend.
  - This establishes a robust foundation for more complex UI features in the future, such as multi-pane layouts, status bars, or real-time context displays.
- **Negative:**
  - Introduces `ink` and `react` as major new dependencies, increasing the project's complexity and bundle size.
  - Requires a significant refactoring of `ChatSession` to separate application logic from presentation, which is a complex but necessary task.
  - Testing the UI components built with `ink` can be more complex than testing the current `inquirer`-based flow.

## Implementation Plan

**Step 1: Project Setup and Dependencies**

1.  Install `ink` and `react`: `npm install ink react`
2.  Verify `ink` and `react` are in `package.json`.

**Step 2: Create the UI Module and Initial Components**

1.  Create a new directory: `src/ui`.
2.  Create a new file `src/ui/ChatView.js` to house the main `ink` application component, which will manage the chat layout, message history, and input field.

**Step 3: Decouple `ChatSession` from Presentation**

1.  In `src/chat-session.js`, remove all dependencies on `inquirer`, `ora`, and direct terminal output.
2.  Refactor the class to only manage state and AI communication, exposing methods like `sendMessage` for the UI to call. The `conductFeaturePlanning` method will be removed in its current interactive form.

**Step 4: Integrate `ink` into `FeatureArchitect`**

1.  In `src/feature-architect.js`, modify the `start()` method. After the state machine reaches the `PLANNING` state, it will call `ink.render()` to start the new `ChatView` UI instead of the old `inquirer` loop.
2.  The `FeatureArchitect` will pass down callbacks to the `ChatView` component to handle sending messages and completing the session.

**Step 5: Update Tests**

1.  Update `src/__tests__/chat-session.test.js` to remove mocks for `inquirer` and test the new logic-focused methods.

## Alternatives Considered

- **`blessed`**: A mature and powerful TUI library. It was rejected because its imperative, event-driven API is generally more complex for managing UI state compared to `ink`'s declarative, component-based model.
- **Manual `readline` Approach**: Using Node.js's built-in `readline` module to manually control the cursor and draw the UI. This was rejected due to its extreme implementation complexity, high maintenance cost, and the difficulty of handling terminal rendering edge cases correctly.
