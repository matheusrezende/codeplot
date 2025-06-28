import { PlanningAgent } from './PlanningAgent';
import { ADRGeneratorAgent } from './ADRGeneratorAgent';
import { logger } from '../utils/logger';

interface ConversationItem {
  role: string;
  content: string;
}

interface PlanningQuestionData {
  header: string;
  bodyText: string;
  optionText: string;
  options: Array<{
    id: string;
    title: string;
    description: string;
    recommended: boolean;
  }>;
  readyForADR: boolean;
}

interface ADRResult {
  adrContent: string;
  adrNumber: string;
  adrTitle: string;
  implementationPlan: string;
}

interface PlanningResponse {
  type: 'planning_question';
  data: PlanningQuestionData;
  conversationHistory: ConversationItem[];
}

interface ADRResponse {
  type: 'adr_generated';
  adr: ADRResult;
  conversationHistory: ConversationItem[];
}

interface ImplementationResponse {
  type: 'implementation_steps';
  steps: string;
}

interface SessionData {
  featureRequest: string;
  codebaseContext: string;
  conversationHistory: ConversationItem[];
  currentPhase: string;
  timestamp: Date;
}

interface PlanningSessionSummary {
  featureRequest: string;
  totalQuestions: number;
  totalResponses: number;
  currentPhase: string;
  keyRequirements: string[];
}

type Phase = 'planning' | 'adr_generation' | 'completed';

export class AgentOrchestrator {
  private planningAgent: PlanningAgent;
  private adrGeneratorAgent: ADRGeneratorAgent;
  private conversationHistory: ConversationItem[];
  private currentPhase: Phase;
  private featureRequest: string;
  private codebaseContext: string;

  constructor(apiKey: string, modelName: string = 'gemini-2.5-pro') {
    this.planningAgent = new PlanningAgent(apiKey, modelName);
    this.adrGeneratorAgent = new ADRGeneratorAgent(apiKey, modelName);
    this.conversationHistory = [];
    this.currentPhase = 'planning';
    this.featureRequest = '';
    this.codebaseContext = '';
  }

  async startPlanning(
    featureRequest: string,
    codebaseContext: string = ''
  ): Promise<PlanningResponse> {
    this.featureRequest = featureRequest;
    this.codebaseContext = codebaseContext;
    this.conversationHistory = [{ role: 'user', content: featureRequest }];

    logger.debug('AgentOrchestrator: Starting planning', {
      featureRequestLength: featureRequest.length,
      codebaseContextLength: codebaseContext.length,
    });

    return this.getNextPlanningQuestion();
  }

  async continueConversation(
    userResponse: string,
    onChunk?: (chunk: string) => void
  ): Promise<PlanningResponse | { type: 'ready_for_adr' }> {
    this.conversationHistory.push({ role: 'user', content: userResponse });

    logger.debug('AgentOrchestrator: Continuing conversation', {
      userResponseLength: userResponse.length,
      conversationHistoryLength: this.conversationHistory.length,
      currentPhase: this.currentPhase,
    });

    // Check if we're ready for ADR generation
    const readinessEvaluation = await this.planningAgent.evaluateReadiness(
      this.featureRequest,
      this.conversationHistory
    );

    logger.debug('AgentOrchestrator: Readiness evaluation', {
      readyForADR: readinessEvaluation.readyForADR,
      missingInformation: readinessEvaluation.missingInformation,
      reasoning: readinessEvaluation.reasoning,
    });

    if (readinessEvaluation.readyForADR) {
      this.currentPhase = 'adr_generation';
      return { type: 'ready_for_adr' };
    }

    // Continue planning with another question
    return this.getNextPlanningQuestion(onChunk);
  }

  private async getNextPlanningQuestion(
    onChunk?: (chunk: string) => void
  ): Promise<PlanningResponse> {
    try {
      logger.debug('AgentOrchestrator: Getting next planning question', {
        conversationHistoryLength: this.conversationHistory.length,
        currentPhase: this.currentPhase,
      });

      const response = await this.planningAgent.askQuestion(
        this.featureRequest,
        this.conversationHistory,
        this.codebaseContext,
        onChunk
      );

      if (response.success && response.data) {
        // Add the AI's question to conversation history
        this.conversationHistory.push({
          role: 'assistant',
          content: response.data.bodyText,
        });

        logger.info('🤖 AI Question:', {
          header: response.data.header,
          question: response.data.optionText,
          optionsCount: response.data.options?.length || 0,
          options:
            response.data.options?.map(
              (opt, idx: number) =>
                `${idx + 1}. ${opt.title}${opt.recommended ? ' ⭐ RECOMMENDED' : ''}`
            ) || [],
        });

        return {
          type: 'planning_question',
          data: response.data,
          conversationHistory: this.conversationHistory,
        };
      } else {
        logger.error('AgentOrchestrator: Planning agent returned error', {
          error: response.error,
          rawResponse: response.rawResponse,
        });
        throw new Error(`Planning agent error: ${response.error}`);
      }
    } catch (error) {
      logger.errorWithStack(
        error as Error,
        'AgentOrchestrator: Failed to get next planning question',
        {
          conversationHistoryLength: this.conversationHistory.length,
          currentPhase: this.currentPhase,
        }
      );
      // Re-throw without modification in debug mode to preserve stack trace
      throw error;
    }
  }

  async generateADR(): Promise<ADRResponse> {
    if (this.currentPhase !== 'adr_generation') {
      throw new Error('Not ready for ADR generation. Complete planning phase first.');
    }

    try {
      const adrResult = await this.adrGeneratorAgent.generateADR(
        this.featureRequest,
        this.conversationHistory,
        this.codebaseContext
      );

      this.currentPhase = 'completed';

      return {
        type: 'adr_generated',
        adr: adrResult,
        conversationHistory: this.conversationHistory,
      };
    } catch (error) {
      throw new Error(`Failed to generate ADR: ${(error as Error).message}`);
    }
  }

  async generateDetailedImplementation(adrContent: string): Promise<ImplementationResponse> {
    try {
      const detailedSteps = await this.adrGeneratorAgent.generateImplementationSteps(
        adrContent,
        this.codebaseContext
      );

      return {
        type: 'implementation_steps',
        steps: detailedSteps,
      };
    } catch (error) {
      throw new Error(`Failed to generate implementation steps: ${(error as Error).message}`);
    }
  }

  // Utility methods
  getCurrentPhase(): Phase {
    return this.currentPhase;
  }

  getConversationHistory(): ConversationItem[] {
    return this.conversationHistory;
  }

  getFeatureRequest(): string {
    return this.featureRequest;
  }

  // Export conversation for session management
  exportSession(): SessionData {
    return {
      featureRequest: this.featureRequest,
      codebaseContext: this.codebaseContext,
      conversationHistory: this.conversationHistory,
      currentPhase: this.currentPhase,
      timestamp: new Date(),
    };
  }

  // Import conversation from saved session
  importSession(sessionData: SessionData): void {
    this.featureRequest = sessionData.featureRequest || '';
    this.codebaseContext = sessionData.codebaseContext || '';
    this.conversationHistory = sessionData.conversationHistory || [];
    this.currentPhase = (sessionData.currentPhase as Phase) || 'planning';
  }

  // Reset for new feature planning
  reset(): void {
    this.conversationHistory = [];
    this.currentPhase = 'planning';
    this.featureRequest = '';
    this.codebaseContext = '';
  }

  // Get a summary of the planning session
  getPlanningSessionSummary(): PlanningSessionSummary {
    const userResponses = this.conversationHistory.filter(item => item.role === 'user');
    const aiQuestions = this.conversationHistory.filter(item => item.role === 'assistant');

    return {
      featureRequest: this.featureRequest,
      totalQuestions: aiQuestions.length,
      totalResponses: userResponses.length - 1, // -1 to exclude initial feature request
      currentPhase: this.currentPhase,
      keyRequirements: userResponses.slice(1).map(response => response.content), // Skip initial feature request
    };
  }
}
