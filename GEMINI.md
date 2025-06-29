# Gemini Code Assistant Context

This document provides context for the Gemini Code Assistant to understand the Codeplot project.

## Project Overview

Codeplot is an interactive CLI tool that uses the Google Gemini API to help developers plan features and generate Architecture Decision Records (ADRs). It analyzes a project's codebase, engages in a dialogue with the user to define feature requirements, and then produces a structured ADR with a technical implementation plan.

The tool is built with TypeScript and runs on Node.js. It features real-time streaming of AI responses and a user-friendly interface built with Ink.

## Key Technologies

- **Language:** TypeScript
- **Runtime:** Node.js
- **CLI Framework:** Commander.js
- **UI:** Ink (React for CLIs)
- **AI:** `@google/generative-ai` (Gemini)
- **Linting:** ESLint
- **Formatting:** Prettier
- **Testing:** Jest
- **Package Manager:** npm

## Commands

### Development

- `npm run dev`: Run the application in development mode with file watching.
- `npm run dev:debug`: Run in development mode with debug logging.
- `npm test`: Run the test suite.
- `npm run lint`: Lint the codebase.
- `npm run format`: Format the code.
- `npm run validate`: Run all checks (lint, format, test).

### Production

- `npm start`: Run the application.
- `codeplot plan`: The main command to start a feature planning session.

## File Structure

- `src/`: Contains the main source code.
  - `agents/`: Houses the AI agent implementations (e.g., `PlanningAgent`, `ADRGeneratorAgent`).
  - `ui/`: Contains the React components for the CLI user interface.
  - `utils/`: Holds utility functions like logging and parsers.
  - `index.ts`: The main entry point of the application.
  - `adr-generator.ts`: Logic for generating ADRs.
  - `chat-session.ts`: Manages the chat interaction with the AI.

## Contribution Guidelines

Contributions should adhere to the existing coding style. Before committing, please ensure that:

1.  The code is properly linted (`npm run lint`).
2.  The code is formatted with Prettier (`npm run format`).
3.  All tests pass (`npm run test`).

Commit messages should follow the Conventional Commits specification.

Before completing any work, run `npm run validate` to ensure all checks pass.
