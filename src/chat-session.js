// This class handles only state management and AI communication
// All presentation logic has been removed and moved to the UI components

export class ChatSession {
  constructor(model, _options = {}) {
    this.model = model;
    this.chatSession = null;

    // Track chat history manually for session persistence
    this.chatHistory = [];

    // Initialize feature data structure
    this.featureData = {
      name: '',
      description: '',
      requirements: [],
      decisions: [],
      implementation_plan: '',
      adr_content: '',
      adrFilename: '',
      adr_title: '',
    };
  }

  async initialize(codebaseContent, sessionData = null, _onAnalysisChunk = null) {
    if (sessionData && sessionData.chatHistory && sessionData.chatHistory.length > 0) {
      // Resuming from existing session
      this.featureData = sessionData.featureData || this.featureData;
      this.chatHistory = sessionData.chatHistory || [];

      try {
        this.chatSession = this.model.startChat({
          history: this.chatHistory,
          generationConfig: {
            temperature: 0.7,
          },
        });

        return 'Session restored';
      } catch (error) {
        throw new Error(`Failed to restore session: ${error.message}`);
      }
    } else {
      // Starting new session - store codebase content for later analysis
      this.codebaseContent = codebaseContent;

      const systemPrompt = `You are a tech lead focused on software architecture and feature planning.

Your job is to help me plan features for my codebase. When I describe a feature I want to build:

1. First, analyze the relevant parts of the codebase to understand the current structure, technologies, and existing patterns that are relevant to the feature.

2. Then:
   - Ask precise, clarifying questions until you have full understanding of the desired behavior, edge cases, and data flows.
   - Generate an ADR (Architecture Decision Record) detailing the chosen approach, rejected alternatives, and reasoning.
   - Produce a step-by-step implementation plan, including file/module changes, interface updates, and any migrations or tests.

Important guidelines:
- Do not assume the presence of users or business context; focus purely on product design and technical implementation.
- Always identify and describe trade-offs in implementation choices.
- Prefer clarity and modularity over optimization.
- Break down large changes into shippable, isolated steps.
- Where appropriate, propose code stubs or schemas to facilitate discussion.
- Ask ONE clarifying question at a time, and provide numbered options when relevant.
- Always provide your recommendation as the first option and highlight it clearly.
- Always number your options starting from 1.
- Make sure the first option is your recommended approach.

## Response Format:
Use only semantic markdown format to respond:

# [Brief section title]

[Detailed analysis and context in markdown]

**[Clarifying question or prompt]**

1. **[First option title]** ⭐ RECOMMENDED
   [Detailed explanation and reasoning]

2. **[Second option title]**
   [Detailed explanation and reasoning]

3. **[Third option title]**
   [Detailed explanation and reasoning]

## Instructions:
- Use a single # header for the response section
- Put your question in **bold**
- Number options starting from 1 and clearly mark the recommended option
- Eliminate JSON entirely, focus on clarity and readability

I have a codebase ready for analysis. Please confirm you're ready to help me plan features and wait for me to describe the feature I want to build.`;

      try {
        this.chatSession = this.model.startChat({
          history: [],
          generationConfig: {
            temperature: 0.7,
          },
        });

        // Add system prompt to history
        this.chatHistory.push({
          role: 'user',
          parts: [{ text: systemPrompt }],
        });

        // Get initial AI response to confirm readiness
        const result = await this.chatSession.sendMessage(systemPrompt);
        const response = result.response.text();

        // Add AI response to history
        this.chatHistory.push({
          role: 'model',
          parts: [{ text: response }],
        });

        return { isNewSession: true, analysis: response };
      } catch (error) {
        throw new Error(`Failed to analyze codebase: ${error.message}`);
      }
    }
  }

  // This method was removed - UI components now handle the interactive planning

  async sendMessage(message) {
    try {
      // Add user message to history
      this.chatHistory.push({
        role: 'user',
        parts: [{ text: message }],
      });

      const result = await this.chatSession.sendMessage(message);
      const response = result.response.text();

      // Add AI response to history
      this.chatHistory.push({
        role: 'model',
        parts: [{ text: response }],
      });

      return response;
    } catch (error) {
      throw new Error(`Failed to get AI response: ${error.message}`);
    }
  }

  async sendMessageStream(message, onChunk) {
    try {
      // Add user message to history
      this.chatHistory.push({
        role: 'user',
        parts: [{ text: message }],
      });

      const result = await this.chatSession.sendMessageStream(message);
      let fullResponse = '';

      // Stream the response
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        if (onChunk) {
          onChunk(chunkText);
        }
      }

      // Add AI response to history
      this.chatHistory.push({
        role: 'model',
        parts: [{ text: fullResponse }],
      });

      return fullResponse;
    } catch (error) {
      throw new Error(`Failed to get AI response: ${error.message}`);
    }
  }

  extractFeatureName(description) {
    // Simple extraction - take first few words and make it filename-safe
    return description
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '') // remove special chars but keep spaces and hyphens
      .trim()
      .split(/\s+/)
      .slice(0, 5) // Increased to 5 words
      .join('-')
      .replace(/-+/g, '-'); // Collapse multiple hyphens
  }

  extractImplementationPlan(adrContent) {
    const planMatch = adrContent.match(/## Implementation Plan\s*([\s\S]*?)(?=## |$)/);
    return planMatch ? planMatch[1].trim() : '';
  }

  extractADRTitle(adrContent) {
    // Extract title from ADR content - look for the pattern "# ADR: [Number] - [Title]"
    const titleMatch = adrContent.match(/# ADR:\s*\d+\s*-\s*(.+)/);
    if (titleMatch) {
      return titleMatch[1].trim();
    }

    // Fallback: look for any markdown header that looks like a title
    const headerMatch = adrContent.match(/^#\s*(.+)$/m);
    if (headerMatch) {
      return headerMatch[1].trim().replace(/^ADR:\s*\d*\s*-?\s*/, '');
    }

    return null;
  }

  generateADRFilename(featureName) {
    const timestamp = new Date().toISOString().split('T')[0];
    const safeFeatureName = featureName
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join('-')
      .replace(/-+/g, '-');
    return `${timestamp}-${safeFeatureName}.md`;
  }

  // This method was removed - UI components now handle ADR modification
}
