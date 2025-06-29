import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { logger } from '../utils/logger';

interface Option {
  id: string;
  title: string;
  description: string;
  recommended: boolean;
}

interface PlanningQuestionData {
  header: string;
  bodyText: string;
  optionText: string;
  options: Option[];
  readyForADR: boolean;
}

interface ResponseSection {
  header?: string;
  body?: string;
  optionPrompt?: string;
  options?: Option[];
}

interface ReadinessEvaluation {
  readyForADR: boolean;
  missingInformation: string[];
  reasoning: string;
}

interface ConversationItem {
  role: string;
  content: string;
}

@injectable()
export class PlanningAgent {
  private model: ChatGoogleGenerativeAI;

  constructor(
    @inject('ApiKey') apiKey: string,
    @inject('ModelName') modelName: string = 'gemini-2.5-pro'
  ) {
    this.model = new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey,
      temperature: 0.5,
    });
  }

  async askQuestion(
    featureRequest: string,
    conversationHistory: ConversationItem[],
    codebaseContext: string = '',
    _onChunk?: (chunk: string) => void
  ): Promise<{
    success: boolean;
    data?: PlanningQuestionData;
    error?: string;
    rawResponse?: string;
  }> {
    logger.debug('PlanningAgent: askQuestion called', {
      featureRequestLength: featureRequest.length,
      conversationHistoryLength: conversationHistory.length,
      codebaseContextLength: codebaseContext.length,
    });

    const questionPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You are a highly analytical software architect focused on eliciting detailed requirements for feature planning and ADR creation.\n\nProvide clear questions to clarify ALL necessary details. Respond with semantic markdown for clarity.\n\nUse concise headings, explicit requirements, and consider integration points.',
      ],
      [
        'human',
        'Feature Request: {featureRequest}\n\nCodebase Context:\n{codebaseContext}\n\nConversation History:\n{conversationHistory}\n\nBased on the above, what questions can we ask to ensure all necessary details are captured for planning an ADR?',
      ],
    ]);

    const chain = questionPrompt.pipe(this.model).pipe(new StringOutputParser());

    const response = await chain.invoke({
      featureRequest,
      codebaseContext,
      conversationHistory: this.formatConversationHistory(conversationHistory),
    });

    return this.parseResponse(response);
  }

  async evaluateReadiness(
    featureRequest: string,
    conversationHistory: ConversationItem[]
  ): Promise<ReadinessEvaluation> {
    logger.debug('PlanningAgent: Evaluating readiness for ADR', {
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

      const parsed: ReadinessEvaluation = JSON.parse(cleanResponse);
      logger.debug('PlanningAgent: Evaluation parsed successfully', { parsed });
      return parsed;
    } catch (error) {
      logger.error('PlanningAgent: Failed to parse evaluation response', {
        error: (error as Error).message,
        response: response?.substring(0, 500) + '...' || 'no response',
      });
      return {
        readyForADR: false,
        missingInformation: ['Unable to evaluate readiness'],
        reasoning: 'Failed to parse evaluation response',
      };
    }
  }

  formatConversationHistory(history: ConversationItem[]): string {
    return history.map(item => `${item.role}: ${item.content}`).join('\n\n');
  }

  parseResponse(response: string): {
    success: boolean;
    data?: PlanningQuestionData;
    error?: string;
    rawResponse?: string;
  } {
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
        error: (error as Error).message,
        response: response?.substring(0, 500) + '...' || 'no response',
      });
      return {
        success: false,
        error: (error as Error).message,
        rawResponse: response,
      };
    }
  }

  extractSections(text: string): ResponseSection {
    const sections: ResponseSection = {};

    // Extract header (first # heading)
    const headerMatch = text.match(/^#\s+(.+)$/m);
    if (headerMatch) {
      sections.header = headerMatch[1].trim();
    }

    // Extract numbered options
    const optionPattern =
      /^(\d+)\s*\.\s*\*\*(.+?)\*\*(?:\s*⭐\s*RECOMMENDED)?\s*[\r\n]([\s\S]*?)(?=^\d+\s*\.|$)/gm;
    const options: Option[] = [];
    let optionMatch: RegExpExecArray | null;

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

    if (headerMatch && headerMatch.index !== undefined) {
      bodyStartIndex = headerMatch.index + headerMatch[0].length;
    }

    if (options.length > 0) {
      // Find the option prompt
      const optionPromptMatch = text.match(/\*\*[^*]+\*\*\s*(?=\n\s*1\.)/i);
      if (optionPromptMatch && optionPromptMatch.index !== undefined) {
        bodyEndIndex = optionPromptMatch.index;
      } else {
        // Fallback: find first option
        const firstOptionMatch = text.match(/^1\s*\./m);
        if (firstOptionMatch && firstOptionMatch.index !== undefined) {
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
