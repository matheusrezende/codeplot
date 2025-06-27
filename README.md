# Codeplot

[![npm version](https://badge.fury.io/js/codeplot.svg)](https://badge.fury.io/js/codeplot)
[![CI/CD Pipeline](https://github.com/matheus/codeplot/actions/workflows/ci.yml/badge.svg)](https://github.com/matheus/codeplot/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/matheus/codeplot/branch/main/graph/badge.svg?token=YOUR_CODECOV_TOKEN)](https://codecov.io/gh/matheus/codeplot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

🧠 Plot your features with AI-powered planning and architecture decisions

An interactive CLI tool that uses Gemini 2.5 Pro to help you plan features and generate Architecture Decision Records (ADRs) for your projects.

## Features

- 📦 **Repository Analysis**: Uses repomix to pack your codebase for AI analysis
- 🤖 **Interactive Planning**: AI-driven conversation to gather feature requirements
- 📝 **ADR Generation**: Automatically creates Architecture Decision Records
- 🎯 **One Question at a Time**: Focused, clarifying questions with options and recommendations
- 🏗️ **Implementation Plans**: Step-by-step technical implementation guidance
- ⚡ **Real-time Streaming**: Watch AI responses appear in real-time with configurable typing speeds
- 🎨 **Enhanced UX**: Beautiful visual indicators and smooth typing animations

## Prerequisites

1. **Node.js** (>=18.0.0)
2. **Gemini API Key** - Get one from [Google AI Studio](https://aistudio.google.com/)
3. **repomix** (optional - will be installed automatically if missing)
4. **adr-tools** (optional - for proper ADR management)

## Installation

1. Clone or download this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Make the CLI globally available:

   ```bash
   npm link
   ```

4. Set your Gemini API key:
   ```bash
   export GEMINI_API_KEY="your_api_key_here"
   ```

## Usage

### Initialize the CLI

```bash
codeplot init
```

### Plan a Feature

```bash
# Default with streaming enabled
codeplot plan --project-path /path/to/your/project

# Fast typing speed
codeplot plan --typing-speed fast

# Disable streaming (instant responses)
codeplot plan --no-streaming

# Slow typing speed for presentation mode
codeplot plan --typing-speed slow
```

### Options

- `-p, --project-path <path>`: Path to your project repository (default: current directory)
- `-k, --api-key <key>`: Gemini API key (or set GEMINI_API_KEY env var)
- `-o, --output-dir <dir>`: Output directory for ADRs (default: ./docs/adrs)
- `--no-streaming`: Disable streaming responses (show all at once)
- `--typing-speed <speed>`: Typing speed for streaming: `fast`, `normal`, `slow` (default: normal)

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

To run in development mode:

```bash
npm run dev
```

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
