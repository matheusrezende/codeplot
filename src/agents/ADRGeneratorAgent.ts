import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { logger } from '../utils/logger';

interface ConversationItem {
  role: string;
  content: string;
}

interface ADRResult {
  adrContent: string;
  adrNumber: string;
  adrTitle: string;
  implementationPlan: string;
}

export class ADRGeneratorAgent {
  private model: ChatGoogleGenerativeAI;
  private systemPrompt: string;

  constructor(apiKey: string, modelName: string = 'gemini-2.5-pro') {
    this.model = new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey,
      temperature: 0.7,
      streaming: true, // Enable streaming support
    });

    this.systemPrompt = `You are a Senior Software Architect focused on ADR CREATION ONLY.

Your SOLE responsibility is to assist the user in creating Architecture Decision Records (ADRs) based on gathered requirements and context.

## Your Process:
1. Understand the feature request and context
2. Use user requirements and context to suggest a comprehensive ADR
3. Ensure the ADR follows proper format and contains necessary details

## Response Format:
You must structure your response in markdown including these sections:
- # ADR: [Title]
- ## Status: [Proposed|Accepted|Rejected]
- ## Context
- ## Decision
- ## Status
- ## Consequences
- ## Implementation Plan

## Important Formatting Rules:
- Use exactly one # header for the ADR title
- Provide clear and concise context, decision, and consequences
- Include a feasible implementation plan with step-by-step guidance

## Critical Rules:
- NEVER create ADRs without user input
- NEVER generate code or implementation directly
- Focus only on structuring user-provided information into ADR format
- Ask questions if context or requirements are unclear

## When to Proceed:
Only begin ADR creation when you have complete understanding of:
✓ Feature behavior and requirements
✓ User interactions and edge cases
✓ Data flows and business rules
✓ Performance and security considerations

Proceeding without all necessary information risks creating an incomplete or incorrect ADR. Always seek clarification when needed.`;
  }

  async generateADR(
    featureRequest: string,
    conversationHistory: ConversationItem[],
    codebaseContext: string
  ): Promise<ADRResult> {
    logger.debug('ADRGeneratorAgent: generateADR called', {
      featureRequestLength: featureRequest.length,
      conversationHistoryLength: conversationHistory.length,
      codebaseContextLength: codebaseContext.length,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', this.systemPrompt],
      [
        'human',
        `Feature Request: {featureRequest}

Codebase Context:
{codebaseContext}

Conversation History:
{conversationHistory}

Generate an ADR in markdown format based on this information.`,
      ],
    ]);

    const chain = prompt.pipe(this.model).pipe(new StringOutputParser());

    const adrResult = await chain.invoke({
      featureRequest,
      codebaseContext,
      conversationHistory: this.formatConversationHistory(conversationHistory),
    });

    logger.info('ADRGeneratorAgent: ADR generated successfully', {
      adrLength: adrResult.length,
    });

    return {
      adrContent: adrResult,
      adrNumber: this.getNextADRNumber(),
      adrTitle: this.extractTitle(adrResult),
      implementationPlan: this.extractImplementationPlan(adrResult),
    };
  }

  async generateImplementationSteps(adrContent: string, codebaseContext: string): Promise<string> {
    logger.debug('ADRGeneratorAgent: generateImplementationSteps called', {
      adrLength: adrContent.length,
      codebaseContextLength: codebaseContext.length,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You are a precision-oriented software architect. Provide detailed implementation steps based on the following ADR content.\\n\\nResponse format:\\n- Step 1: [Detailed step description]\\n- Step 2: [Detailed step description]\\n- Include code snippets when applicable.\\n',
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

  formatConversationHistory(history: ConversationItem[]): string {
    return history
      .map(item => {
        if (item.role === 'user') {
          return `**Requirement**: ${item.content}`;
        } else if (item.role === 'assistant') {
          return `**Question**: ${item.content}`;
        }
        return `**${item.role}**: ${item.content}`;
      })
      .join('\\n\\n');
  }

  extractTitle(adrContent: string): string {
    const titleMatch = adrContent.match(/# ADR:\\s*\\d+\\s*-\\s*(.+)/);
    return titleMatch ? titleMatch[1].trim() : 'Untitled ADR';
  }

  extractImplementationPlan(adrContent: string): string {
    const planMatch = adrContent.match(/## Implementation Plan\\s*([\\s\\S]*?)(?=## |$)/);
    return planMatch ? planMatch[1].trim() : '';
  }

  getNextADRNumber(): string {
    // In a real implementation, this would read existing ADRs to determine the next number
    // For now, we'll use a timestamp-based approach
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}${month}${day}-001`;
  }
}
