# Codeplot

[![npm version](https://badge.fury.io/js/codeplot.svg)](https://badge.fury.io/js/codeplot)
[![CI/CD Pipeline](https://github.com/matheusrezende/codeplot/actions/workflows/ci.yml/badge.svg)](https://github.com/matheusrezende/codeplot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

> 🧠 **Plot your features with AI-powered planning and architecture decisions**

An interactive CLI tool that uses **Google Gemini AI** to help you plan features and generate Architecture Decision Records (ADRs) for your projects. Get AI-powered technical guidance, implementation plans, and properly structured ADRs without leaving your terminal.

## Features

- 📦 **Repository Analysis**: Uses repomix to pack your codebase for AI analysis
- 🤖 **Interactive Planning**: AI-driven conversation to gather feature requirements
- 📝 **ADR Generation**: Automatically creates Architecture Decision Records
- 🎯 **One Question at a Time**: Focused, clarifying questions with options and recommendations
- 🏗️ **Implementation Plans**: Step-by-step technical implementation guidance
- 💾 **Session Management**: Save, resume, and modify planning sessions with persistent state
- ⚡ **Real-time Streaming**: Watch AI responses appear in real-time with configurable typing speeds
- 🎨 **Enhanced UX**: Beautiful visual indicators and smooth typing animations

## Prerequisites

1. **Node.js** (>=20.0.0) - This project uses Volta for Node.js version management
2. **Gemini API Key** - Get one from [Google AI Studio](https://aistudio.google.com/)
3. **repomix** (optional - will be installed automatically if missing)
4. **adr-tools** (optional - for proper ADR management)
5. **Volta** (recommended) - For automatic Node.js version management

## Installation

### Global Installation (Recommended)

Install Codeplot globally using npm:

```bash
npm install -g codeplot
```

### Using npx (No Installation Required)

Run Codeplot without installing:

```bash
npx codeplot init
npx codeplot plan --project-path /path/to/your/project
```

### API Key Setup

Set your Gemini API key as an environment variable:

```bash
export GEMINI_API_KEY="your_api_key_here"

# Or add to your shell profile for persistence
echo 'export GEMINI_API_KEY="your_api_key_here"' >> ~/.bashrc
# or ~/.zshrc for zsh users
```

### Dependencies

Codeplot will automatically install missing dependencies:

- **repomix**: For repository analysis (installed automatically if missing)
- **adr-tools**: For proper ADR management (optional, see [installation guide](https://github.com/npryce/adr-tools#installation))

```bash
# Optional: Install adr-tools for enhanced ADR management
npm install -g adr-tools
# or on macOS with Homebrew
brew install adr-tools
```

## Usage

### Initialize the CLI

```bash
codeplot init
```

### Plan a Feature

```bash
# Default with streaming enabled (uses gemini-2.5-pro)
codeplot plan --project-path /path/to/your/project

# Use a different model
codeplot plan --model gemini-2.0-flash-exp

# Fast typing speed
codeplot plan --typing-speed fast

# Disable streaming (instant responses)
codeplot plan --no-streaming

# Slow typing speed for presentation mode
codeplot plan --typing-speed slow
```

### Session Management

Codeplot automatically saves your planning sessions and allows you to resume or modify them:

```bash
# Sessions are automatically saved during planning
codeplot plan

# When you have completed sessions, you'll be prompted with options:
# 1. Start a new planning session
# 2. Review current ADR
# 3. Modify/refine current ADR
# 4. Exit
```

**Session Features:**

- **Auto-save**: Every interaction is automatically saved
- **Resume**: Continue where you left off if interrupted
- **Modify**: Refine existing ADRs through additional conversations
- **Review**: Read completed ADRs before making changes
- **Interactive Loop**: Seamlessly transition between reviewing and modifying

### Options

- `-p, --project-path <path>`: Path to your project repository (default: current directory)
- `-k, --api-key <key>`: Gemini API key (or set GEMINI_API_KEY env var)
- `-m, --model <model>`: Gemini model to use (default: gemini-2.5-pro, or set GEMINI_MODEL env var)
- `-o, --output-dir <dir>`: Output directory for ADRs (default: ./doc/adr)
- `--no-streaming`: Disable streaming responses (show all at once)
- `--typing-speed <speed>`: Typing speed for streaming: `fast`, `normal`, `slow` (default: normal)

### Available Models

You can specify different Gemini models based on your needs:

- `gemini-2.5-pro` (default) - Latest and most capable model, best for complex planning
- `gemini-2.0-flash-exp` - Faster experimental model, good for quick interactions
- `gemini-1.5-pro` - Previous generation, reliable and well-tested
- `gemini-1.5-flash` - Optimized for speed and efficiency

```bash
# Use via CLI flag
codeplot plan --model gemini-2.0-flash-exp

# Or set environment variable
export GEMINI_MODEL="gemini-2.0-flash-exp"
codeplot plan
```

## How It Works

1. **Repository Packing**: The tool uses repomix to create a comprehensive view of your codebase
2. **AI Analysis**: Gemini 2.5 Pro analyzes your codebase structure and technologies
3. **Interactive Planning**: The AI asks focused questions to understand your feature requirements
4. **ADR Generation**: Creates a structured Architecture Decision Record with implementation plan

## Example Session

```bash
$ codeplot plan

📊  Codeplot
AI-powered feature planning and architecture decisions

📦 Step 1: Packing repository with repomix...
✅ Repository packed successfully

🤖 Step 2: Initializing AI with codebase analysis...
✅ AI initialized and ready

🤖 AI Analysis:
I can see this is a Node.js project using Express.js with a typical MVC structure...

💬 Step 3: Interactive feature planning session
? What feature would you like to build? User authentication system

🤖 AI:
I understand you want to build a user authentication system. Let me ask some clarifying questions:

What type of authentication would you prefer?
1. JWT-based authentication (recommended for APIs)
2. Session-based authentication (traditional web apps)
3. OAuth integration (Google, GitHub, etc.)

My recommendation: JWT-based authentication as it fits well with your existing API structure.

? Your response: JWT-based authentication

🤖 AI:
Great choice! Now, what user information do you need to store?
1. Basic (email, password)
2. Profile data (name, avatar, preferences)
3. Role-based access control

? Your response: Basic email and password with role-based access

...

📝 Step 4: Generating Architecture Decision Record...
✅ ADR generated successfully

🎉 Feature planning completed!
ADR saved to: ./docs/adrs/2025-06-27-user-authentication-system.md
```

## System Prompt

The AI uses a carefully crafted system prompt that focuses on:

- Software architecture and technical implementation
- One clarifying question at a time
- Providing options with recommendations
- Generating comprehensive ADRs with implementation plans
- Identifying trade-offs in implementation choices

## Output Structure

Generated ADRs follow this structure:

- **Status**: Proposed/Accepted/Rejected
- **Context**: Background and motivation
- **Decision**: The architectural choice made
- **Consequences**: Trade-offs and implications
- **Implementation Plan**: Step-by-step technical plan
- **Alternatives Considered**: Other options and why they were rejected

## Development

### With Volta (Recommended)

This project uses Volta to pin Node.js and npm versions. When you enter the project directory, Volta will automatically switch to the correct versions (Node.js 22.17.0 LTS, npm 10.9.2).

### Running in Development Mode

```bash
npm run dev
```

### Available Scripts

- `npm run dev` - Run with file watching
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run validate` - Run all checks (lint, format, test)

## Troubleshooting

### repomix not found

The tool will automatically install repomix if it's missing. If you encounter issues:

```bash
npm install -g repomix
```

### adr-tools not found

ADRs will still be generated without adr-tools, but for proper ADR management:

```bash
# npm
npm install -g adr-tools

# or macOS with Homebrew
brew install adr-tools
```

### API Rate Limits

If you hit Gemini API rate limits, the tool will show appropriate error messages. Consider:

- Using shorter sessions
- Spreading usage over time
- Checking your API quota

## License

MIT
