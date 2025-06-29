import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { DynamicTool } from '@langchain/core/tools';
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

@injectable()
export class PRDAgent {
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

  async askQuestion(history: BaseMessage[], tools: DynamicTool[] = []): Promise<AIMessage> {
    logger.debug('PRDAgent: askQuestion called', {
      conversationHistoryLength: history.length,
      toolCount: tools.length,
    });

    const questionPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You are a Senior Product Manager focused on eliciting detailed requirements for a Product Requirements Document (PRD).\n\n' +
          'Your goal is to understand the "why" behind the feature. Proactively use the provided tools to search for existing documentation before asking the user.\n\n' +
          'Ask clarifying questions about the problem statement, user personas, success metrics, user stories, and functional requirements.\n\n' +
          'The first message from the user will contain the initial feature idea and any relevant context.',
      ],
      new MessagesPlaceholder('history'),
    ]);

    const modelWithTools = this.model.bindTools(tools);
    const chain = questionPrompt.pipe(modelWithTools);

    const response = await chain.invoke({
      history,
    });

    return response;
  }

  async evaluateReadiness(history: BaseMessage[]): Promise<ReadinessEvaluation> {
    logger.debug('PRDAgent: Evaluating readiness for PRD', {
      historyLength: history.length,
    });

    const evaluationPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You are evaluating if enough information has been gathered to create a PRD.\n\nYou must respond with valid JSON in this exact format:\n{{\n  "readyForPRD": boolean,\n  "missingInformation": ["list", "of", "missing", "details"],\n  "reasoning": "explanation of decision"\n}}\n\nOnly return readyForPRD as true if ALL these areas are fully understood:\n- Problem Statement & Goals\n- Target User Personas\n- Key Success Metrics\n- A comprehensive set of User Stories or Functional Requirements\n\nDo not include any additional text outside the JSON response.',
      ],
      new MessagesPlaceholder('history'),
    ]);

    const chain = evaluationPrompt.pipe(this.model).pipe(new StringOutputParser());

    const response = await chain.invoke({
      history,
    });

    try {
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      cleanResponse = cleanResponse.trim();
      const parsed: ReadinessEvaluation = JSON.parse(cleanResponse);
      return parsed;
    } catch (error) {
      logger.error('PRDAgent: Failed to parse evaluation response', {
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

  public parseResponse(response: string): {
    success: boolean;
    data?: PlanningQuestionData;
    error?: string;
    rawResponse?: string;
  } {
    try {
      const sections = this.extractSections(response);
      return {
        success: true,
        data: {
          header: sections.header || 'Product Question',
          bodyText: sections.body || '',
          optionText: sections.optionPrompt || 'Please choose an option:',
          options: sections.options || [],
          readyForADR: false,
        },
      };
    } catch (error) {
      logger.error('PRDAgent: Failed to parse response', {
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

  private extractSections(text: string): ResponseSection {
    const sections: ResponseSection = {};
    const headerMatch = text.match(/^#\s+(.+)$/m);
    if (headerMatch) {
      sections.header = headerMatch[1].trim();
    }
    const optionPattern =
      /^(\d+)\s*\.\s*\*\*(.+?)\*\*(?:\s*⭐\s*RECOMMENDED)?\s*[\r\n]([\s\S]*?)(?=^\d+\s*\.|$)/gm;
    const options: Option[] = [];
    let optionMatch: RegExpExecArray | null;
    while ((optionMatch = optionPattern.exec(text)) !== null) {
      const [, id, title, description] = optionMatch;
      const isRecommended = /⭐\s*RECOMMENDED/.test(optionMatch[0]) || id === '1';
      options.push({
        id,
        title: title.trim(),
        description: description.trim().replace(/^\s*[-*]?\s*/, ''),
        recommended: isRecommended,
      });
    }
    if (options.length > 0) {
      sections.options = options;
      const optionPromptMatch = text.match(/\*\*([^*]+)\*\*\s*(?=\n\s*1\.)/i);
      if (optionPromptMatch) {
        sections.optionPrompt = optionPromptMatch[1].trim();
      }
    }
    let bodyStartIndex = 0;
    if (headerMatch?.index !== undefined) {
      bodyStartIndex = headerMatch.index + headerMatch[0].length;
    }
    let bodyEndIndex = text.length;
    const firstOptionMatch = text.match(/^\d+\s*\./m);
    if (firstOptionMatch?.index !== undefined) {
      bodyEndIndex = firstOptionMatch.index;
    }
    const bodyText = text.substring(bodyStartIndex, bodyEndIndex).trim();
    if (bodyText) {
      sections.body = bodyText;
    }
    return sections;
  }
}
