export class ChatSession {
  public model: any;
  public chatSession: any | null;
  public chatHistory: any[];
  public featureData: Record<string, any>;
  public codebaseContent: any;

  constructor(model: any, _options: Record<string, any> = {}) {
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

  async initialize(
    codebaseContent: any,
    _onAnalysisChunk: ((chunk: string) => void) | null = null
  ): Promise<{ isNewSession: boolean; analysis: string }> {
    // Starting new session - store codebase content for later analysis
    this.codebaseContent = codebaseContent;

    const systemPrompt = `You are a tech lead focused on software architecture and feature planning.

Your job is to help me plan features for my codebase. When I describe a feature I want to build:

1. First, analyze the relevant parts of the codebase to understand the current structure, technologies, and existing patterns that are relevant to the feature.

2. Then ask ONE clarifying question at a time with numbered options for me to choose from.

CRITICAL REQUIREMENTS:
- Ask ONLY ONE question per response
- ALWAYS provide exactly 3-4 numbered options for me to choose from
- Number your options starting from 1
- Make the first option your recommended approach and mark it with ⭐ RECOMMENDED
- Keep each response focused and concise
- Wait for my answer before asking the next question

## Response Format (MANDATORY):

# [Brief title]

[Brief context or analysis - max 2-3 sentences]

**[Single clarifying question]**

1. **[First option]** ⭐ RECOMMENDED
   [Brief explanation]

2. **[Second option]**
   [Brief explanation]

3. **[Third option]**
   [Brief explanation]

4. **[Fourth option]** (if needed)
   [Brief explanation]

Do NOT provide multiple questions or extensive analysis. Keep it simple and interactive.

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
    } catch (error: any) {
      throw new Error(`Failed to analyze codebase: ${error.message}`);
    }
  }

  async sendMessage(message: string): Promise<string> {
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
    } catch (error: any) {
      throw new Error(`Failed to get AI response: ${error.message}`);
    }
  }

  async sendMessageStream(message: string, onChunk: (chunk: string) => void): Promise<string> {
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
        onChunk(chunkText);
      }

      // Add AI response to history
      this.chatHistory.push({
        role: 'model',
        parts: [{ text: fullResponse }],
      });

      return fullResponse;
    } catch (error: any) {
      throw new Error(`Failed to get AI response: ${error.message}`);
    }
  }

  extractFeatureName(description: string): string {
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

  extractImplementationPlan(adrContent: string): string {
    const planMatch = adrContent.match(/## Implementation Plan\s*([\s\S]*?)(?=## |$)/);
    return planMatch ? planMatch[1].trim() : '';
  }

  extractADRTitle(adrContent: string): string | null {
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

  generateADRFilename(featureName: string): string {
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
}
