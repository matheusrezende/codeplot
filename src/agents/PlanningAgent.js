import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { logger } from '../utils/logger.js';

export class PlanningAgent {
  constructor(apiKey) {
    this.model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash-exp',
      apiKey,
      temperature: 0.7,
    });

    this.systemPrompt = `You are a Senior Software Architect focused on FEATURE PLANNING ONLY.

Your SOLE responsibility is to ask clarifying questions to understand a feature request in complete detail. You must NEVER generate ADRs, implementation plans, or code suggestions.

## Your Process:
1. Analyze the feature request and codebase context
2. Ask ONE focused clarifying question at a time
3. Continue until you have complete understanding of:
   - Exact feature behavior and requirements
   - User interactions and edge cases
   - Data flows and business rules
   - Integration points with existing code
   - Performance and security considerations

## Response Format:
You MUST respond using this semantic markdown format:

# [Brief section title]

[Your analysis and context in markdown format]

**[Your clarifying question]**

1. **[First option title]** ⭐ RECOMMENDED
   [Detailed explanation of this option]

2. **[Second option title]**
   [Detailed explanation of this option]

3. **[Third option title]**
   [Detailed explanation of this option]

## Important formatting rules:
- Use exactly one # header at the start
- Put your question in **bold** before the options
- Number options starting from 1
- Mark your recommended option with ⭐ RECOMMENDED
- Keep option titles concise but descriptive
- Provide detailed explanations under each option

## Critical Rules:
- NEVER generate implementation plans or code
- NEVER create ADRs or architectural decisions
- Focus only on understanding requirements completely
- Ask about edge cases, error handling, performance needs
- Explore integration with existing systems
- Consider user experience and business rules

## When NOT Ready for ADR:
- Missing user interaction details
- Unclear data requirements
- Unknown integration points
- Undefined error handling
- Missing performance requirements
- Unclear business rules

## When Ready for ADR:
Only when you have complete understanding of:
✓ Exact feature behavior
✓ All user interactions
✓ Complete data requirements
✓ Integration points identified
✓ Error handling defined
✓ Performance requirements clear
✓ Security considerations addressed

Remember: Your job is to ASK QUESTIONS, not provide solutions!`;
  }

  async askQuestion(featureRequest, conversationHistory, codebaseContext, onChunk = null) {
    logger.debug('PlanningAgent: askQuestion called', {
      featureRequestLength: featureRequest?.length || 0,
      conversationHistoryLength: conversationHistory?.length || 0,
      codebaseContextLength: codebaseContext?.length || 0,
      streaming: !!onChunk,
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

Ask your next clarifying question to better understand this feature. Focus on areas that need more detail.`,
      ],
    ]);

    const chain = prompt.pipe(this.model).pipe(new StringOutputParser());

    logger.debug('PlanningAgent: Invoking LLM chain');
    const startTime = Date.now();

    const inputData = {
      featureRequest,
      codebaseContext,
      conversationHistory: this.formatConversationHistory(conversationHistory),
    };

    if (onChunk) {
      // Stream the response
      let fullResponse = '';

      try {
        const stream = await chain.stream(inputData);

        for await (const chunk of stream) {
          fullResponse += chunk;
          onChunk(chunk);
        }

        const duration = Date.now() - startTime;
        logger.debug('PlanningAgent: Streaming LLM response completed', {
          duration: `${duration}ms`,
          responseLength: fullResponse?.length || 0,
        });

        return this.parseResponse(fullResponse);
      } catch (error) {
        logger.error('PlanningAgent: Streaming failed, falling back to non-streaming', {
          error: error.message,
        });
        // Fall back to non-streaming
      }
    }

    // Non-streaming response
    const response = await chain.invoke(inputData);

    const duration = Date.now() - startTime;
    logger.debug('PlanningAgent: LLM response received', {
      duration: `${duration}ms`,
      responseLength: response?.length || 0,
    });

    return this.parseResponse(response);
  }

  async evaluateReadiness(featureRequest, conversationHistory) {
    // Add safety checks
    if (!featureRequest) {
      logger.warn('PlanningAgent: evaluateReadiness called with empty featureRequest');
      return {
        readyForADR: false,
        missingInformation: ['Feature request is required'],
        reasoning: 'No feature request provided',
      };
    }

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      logger.warn('PlanningAgent: evaluateReadiness called with invalid conversationHistory');
      conversationHistory = [];
    }

    logger.debug('PlanningAgent: evaluateReadiness called', {
      featureRequestLength: featureRequest?.length || 0,
      conversationHistoryLength: conversationHistory?.length || 0,
      featureRequest: featureRequest?.substring(0, 100) + '...',
      conversationHistory,
    });

    const evaluationPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You are evaluating if enough information has been gathered to create an ADR.\n\nYou must respond with valid JSON in this exact format:\n{{\n  "readyForADR": boolean,\n  "missingInformation": ["list", "of", "missing", "details"],\n  "reasoning": "explanation of decision"\n}}\n\nOnly return readyForADR as true if ALL these areas are fully understood:\n- Exact feature behavior and user interactions\n- Complete data requirements and flows\n- Integration points with existing systems\n- Error handling and edge cases\n- Performance and security requirements\n- Business rules and validation logic\n\nDo not include any additional text outside the JSON response.',
      ],
      [
        'human',
        'Feature Request: {featureRequest}\n\nConversation History:\n{conversationHistory}\n\nEvaluate if we have enough information to create an ADR.',
      ],
    ]);

    const chain = evaluationPrompt.pipe(this.model).pipe(new StringOutputParser());

    logger.debug('PlanningAgent: Invoking evaluation chain');
    const startTime = Date.now();

    const formattedHistory = this.formatConversationHistory(conversationHistory);
    logger.debug('PlanningAgent: About to invoke chain with params', {
      featureRequest: featureRequest?.substring(0, 100) + '...',
      conversationHistory: formattedHistory?.substring(0, 200) + '...',
    });

    const response = await chain.invoke({
      featureRequest,
      conversationHistory: formattedHistory,
    });

    const duration = Date.now() - startTime;
    logger.debug('PlanningAgent: Evaluation response received', {
      duration: `${duration}ms`,
      responseLength: response?.length || 0,
    });

    try {
      // Clean the response to extract JSON from markdown code blocks if present
      let cleanResponse = response.trim();

      // Remove markdown code block markers if present
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      cleanResponse = cleanResponse.trim();
      logger.debug('PlanningAgent: Cleaned response for parsing', {
        originalLength: response?.length || 0,
        cleanedLength: cleanResponse?.length || 0,
        cleanedPreview: cleanResponse?.substring(0, 200) + '...' || 'no response',
      });

      const parsed = JSON.parse(cleanResponse);
      logger.debug('PlanningAgent: Evaluation parsed successfully', { parsed });
      return parsed;
    } catch (error) {
      logger.error('PlanningAgent: Failed to parse evaluation response', {
        error: error.message,
        response: response?.substring(0, 500) + '...' || 'no response',
      });
      return {
        readyForADR: false,
        missingInformation: ['Unable to evaluate readiness'],
        reasoning: 'Failed to parse evaluation response',
      };
    }
  }

  formatConversationHistory(history) {
    return history.map(item => `${item.role}: ${item.content}`).join('\n\n');
  }

  parseResponse(response) {
    try {
      logger.debug('PlanningAgent: Parsing response', {
        responseLength: response?.length || 0,
        responsePreview: response?.substring(0, 200) + '...' || 'no response',
      });

      // Parse semantic markdown format
      const sections = this.extractSections(response);

      logger.debug('PlanningAgent: Extracted sections', {
        sectionKeys: Object.keys(sections),
        hasHeader: !!sections.header,
        hasBody: !!sections.body,
        hasOptions: !!sections.options,
        optionsCount: sections.options?.length || 0,
      });

      return {
        success: true,
        data: {
          header: sections.header || 'Planning Question',
          bodyText: sections.body || '',
          optionText: sections.optionPrompt || 'Please choose an option:',
          options: sections.options || [],
          readyForADR: false,
        },
      };
    } catch (error) {
      logger.error('PlanningAgent: Failed to parse response', {
        error: error.message,
        response: response?.substring(0, 500) + '...' || 'no response',
      });
      return {
        success: false,
        error: error.message,
        rawResponse: response,
      };
    }
  }

  extractSections(text) {
    const sections = {};

    // Extract header (first # heading)
    const headerMatch = text.match(/^#\s+(.+)$/m);
    if (headerMatch) {
      sections.header = headerMatch[1].trim();
    }

    // Extract numbered options
    const optionPattern =
      /^(\d+)\s*\.\s*\*\*(.+?)\*\*(?:\s*⭐\s*RECOMMENDED)?\s*[\r\n]([\s\S]*?)(?=^\d+\s*\.|$)/gm;
    const options = [];
    let optionMatch;

    while ((optionMatch = optionPattern.exec(text)) !== null) {
      const [fullMatch, id, title, description] = optionMatch;
      const isRecommended = fullMatch.includes('⭐ RECOMMENDED') || id === '1';
      options.push({
        id,
        title: title.trim(),
        description: description.trim().replace(/^\s*[-*]?\s*/, ''),
        recommended: isRecommended,
      });
    }

    if (options.length > 0) {
      sections.options = options;

      // Look for option prompt before the options (text in **bold**)
      const optionPromptMatch = text.match(/\*\*([^*]+)\*\*\s*(?=\n\s*1\.)/i);
      if (optionPromptMatch) {
        sections.optionPrompt = optionPromptMatch[1].trim();
      }
    }

    // Extract body text (everything between header and options prompt, or just main content)
    let bodyStartIndex = 0;
    let bodyEndIndex = text.length;

    if (headerMatch) {
      bodyStartIndex = headerMatch.index + headerMatch[0].length;
    }

    if (options.length > 0) {
      // Find the option prompt
      const optionPromptMatch = text.match(/\*\*[^*]+\*\*\s*(?=\n\s*1\.)/i);
      if (optionPromptMatch) {
        bodyEndIndex = optionPromptMatch.index;
      } else {
        // Fallback: find first option
        const firstOptionMatch = text.match(/^1\s*\./m);
        if (firstOptionMatch) {
          bodyEndIndex = firstOptionMatch.index;
        }
      }
    }

    const bodyText = text.substring(bodyStartIndex, bodyEndIndex).trim();
    if (bodyText) {
      sections.body = bodyText;
    }

    return sections;
  }
}
