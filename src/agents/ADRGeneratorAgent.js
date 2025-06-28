import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

export class ADRGeneratorAgent {
  constructor(apiKey) {
    this.model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash-exp',
      apiKey,
      temperature: 0.3, // Lower temperature for more consistent ADR generation
    });

    this.systemPrompt = `You are a Senior Software Architect specialized in creating comprehensive Architecture Decision Records (ADRs).

Your SOLE responsibility is to generate high-quality ADRs based on feature requirements that have been thoroughly planned.

## ADR Structure:
You must generate ADRs using this EXACT format:

# ADR: [Number] - [Descriptive Title]

## Status
Proposed

## Context
[Detailed context about the feature, current system state, and why this decision is needed]

## Decision
[The specific architectural decision being made, including key technologies, patterns, and approaches]

## Consequences

### Positive
- [Specific positive outcomes]
- [Benefits to the system]

### Negative
- [Potential drawbacks]
- [Trade-offs being made]

## Implementation Plan

### Phase 1: [Phase Name]
- [ ] Specific task 1
- [ ] Specific task 2

### Phase 2: [Phase Name]
- [ ] Specific task 1
- [ ] Specific task 2

### Phase 3: [Phase Name]
- [ ] Specific task 1
- [ ] Specific task 2

## Alternatives Considered

### Alternative 1: [Name]
- **Description**: [What it is]
- **Pros**: [Benefits]
- **Cons**: [Drawbacks]
- **Rejected because**: [Specific reason]

### Alternative 2: [Name]
- **Description**: [What it is]
- **Pros**: [Benefits]
- **Cons**: [Drawbacks]
- **Rejected because**: [Specific reason]

## Definition of Done
- [ ] Specific acceptance criteria
- [ ] Testing requirements
- [ ] Documentation requirements

## Critical Rules:
- Create realistic, actionable implementation plans
- Include specific file names and code locations when possible
- Consider the existing codebase structure and patterns
- Provide comprehensive alternatives that were considered
- Include measurable definition of done criteria
- Focus on architectural decisions, not just features
- Consider scalability, maintainability, and performance implications

## Title Guidelines:
The ADR title should reflect the ARCHITECTURAL DECISION, not just the feature name. Examples:
- "Implement GraphQL API for Real-time Data Access"
- "Adopt Microservices Architecture for User Management"
- "Integrate Redis for Session State Management"
- "Implement Event-Driven Architecture for Notifications"`;
  }

  async generateADR(
    featureRequest,
    conversationHistory,
    codebaseContext,
    adrNumber = this.getNextADRNumber()
  ) {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', this.systemPrompt],
      [
        'human',
        `Generate a comprehensive ADR for the following feature that has been thoroughly planned:

Feature Request: {featureRequest}

Detailed Requirements from Planning Session:
{conversationHistory}

Codebase Context:
{codebaseContext}

ADR Number: {adrNumber}

Create a complete ADR that addresses all the requirements gathered during the planning session. Ensure the title reflects the architectural decision being made, not just the feature name.`,
      ],
    ]);

    const chain = prompt.pipe(this.model).pipe(new StringOutputParser());

    const response = await chain.invoke({
      featureRequest,
      conversationHistory: this.formatConversationHistory(conversationHistory),
      codebaseContext,
      adrNumber,
    });

    return {
      adrContent: response,
      adrNumber,
      title: this.extractTitle(response),
      implementationPlan: this.extractImplementationPlan(response),
    };
  }

  async generateImplementationSteps(adrContent, codebaseContext) {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are generating detailed implementation steps for an ADR.

Create a detailed, step-by-step implementation guide with:
- Specific file names and locations
- Code snippets where helpful
- Order of implementation
- Dependencies between steps
- Testing strategies

Return as structured markdown.`,
      ],
      [
        'human',
        `ADR Content:
{adrContent}

Codebase Context:
{codebaseContext}

Generate detailed implementation steps that reference specific files and provide actionable guidance.`,
      ],
    ]);

    const chain = prompt.pipe(this.model).pipe(new StringOutputParser());

    return await chain.invoke({
      adrContent,
      codebaseContext,
    });
  }

  formatConversationHistory(history) {
    return history
      .map(item => {
        if (item.role === 'user') {
          return `**Requirement**: ${item.content}`;
        } else if (item.role === 'assistant') {
          return `**Question**: ${item.content}`;
        }
        return `**${item.role}**: ${item.content}`;
      })
      .join('\n\n');
  }

  extractTitle(adrContent) {
    const titleMatch = adrContent.match(/# ADR:\s*\d+\s*-\s*(.+)/);
    return titleMatch ? titleMatch[1].trim() : 'Untitled ADR';
  }

  extractImplementationPlan(adrContent) {
    const planMatch = adrContent.match(/## Implementation Plan\s*([\s\S]*?)(?=## |$)/);
    return planMatch ? planMatch[1].trim() : '';
  }

  getNextADRNumber() {
    // In a real implementation, this would read existing ADRs to determine the next number
    // For now, we'll use a timestamp-based approach
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}${month}${day}-001`;
  }
}
