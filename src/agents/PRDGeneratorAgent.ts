import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { logger } from '../utils/logger';
import { PRD } from '../types/prd';

@injectable()
export class PRDGeneratorAgent {
  private model: ChatGoogleGenerativeAI;
  private systemPrompt: string;

  constructor(
    @inject('ApiKey') apiKey: string,
    @inject('ModelName') modelName: string = 'gemini-2.5-pro'
  ) {
    this.model = new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey,
      temperature: 0.7,
    });

    this.systemPrompt = `You are a Senior Product Manager responsible for creating a well-structured Product Requirements Document (PRD).
Your SOLE task is to synthesize a conversation into a structured PRD.
## Your Process:
1.  Review the entire conversation history.
2.  Extract key information related to the problem, goals, users, and requirements.
3.  Structure this information into a formal PRD.
## Response Format:
You MUST respond with a valid JSON object in this exact format:
{{
  "title": "PRD Title",
  "sections": [
    {{ "title": "Problem Statement", "content": "..." }},
    {{ "title": "Goals & Success Metrics", "content": "..." }},
    {{ "title": "User Personas", "content": "..." }},
    {{ "title": "User Stories", "content": "..." }},
    {{ "title": "Functional Requirements", "content": "..." }},
    {{ "title": "Out of Scope", "content": "..." }}
  ]
}}
Do not include any additional text, markdown, or explanations outside of the JSON object.`;
  }

  async generatePRD(featureRequest: string, conversationHistory: BaseMessage[]): Promise<PRD> {
    logger.debug('PRDGeneratorAgent: generatePRD called', {
      featureRequestLength: featureRequest.length,
      conversationHistoryLength: conversationHistory.length,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', this.systemPrompt],
      new MessagesPlaceholder('history'),
    ]);

    const chain = prompt.pipe(this.model).pipe(new StringOutputParser());

    const initialMessage = new HumanMessage(`Feature Request: ${featureRequest}`);
    const history = [initialMessage, ...conversationHistory.slice(1)];

    const prdResultString = await chain.invoke({
      history,
    });

    try {
      let cleanResponse = prdResultString.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      const parsed: PRD = JSON.parse(cleanResponse);
      logger.info('PRDGeneratorAgent: PRD generated and parsed successfully');
      return parsed;
    } catch (error) {
      logger.error('PRDGeneratorAgent: Failed to parse PRD response', {
        error: (error as Error).message,
        response: prdResultString,
      });
      throw new Error('Failed to generate a valid PRD.');
    }
  }
}
