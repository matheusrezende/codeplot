import { PlanningAgent } from './PlanningAgent.js';
import { ADRGeneratorAgent } from './ADRGeneratorAgent.js';
import { logger } from '../utils/logger.js';

export class AgentOrchestrator {
  constructor(apiKey) {
    this.planningAgent = new PlanningAgent(apiKey);
    this.adrGeneratorAgent = new ADRGeneratorAgent(apiKey);

    this.conversationHistory = [];
    this.currentPhase = 'planning'; // 'planning' | 'adr_generation' | 'completed'
    this.featureRequest = '';
    this.codebaseContext = '';
  }

  async startPlanning(featureRequest, codebaseContext) {
    logger.debug('AgentOrchestrator: Starting planning', {
      featureRequest: featureRequest.substring(0, 100) + '...',
      codebaseContextLength: codebaseContext?.length || 0,
    });

    this.featureRequest = featureRequest;
    this.codebaseContext = codebaseContext;
    this.currentPhase = 'planning';
    this.conversationHistory = [];

    // Add the initial feature request to history
    this.conversationHistory.push({
      role: 'user',
      content: featureRequest,
      timestamp: new Date(),
    });

    return await this.getNextPlanningQuestion();
  }

  async respondToQuestion(userResponse) {
    logger.debug('AgentOrchestrator: Responding to question', {
      userResponse: userResponse.substring(0, 100) + '...',
      conversationHistoryLength: this.conversationHistory.length,
      currentPhase: this.currentPhase,
    });

    // Add user response to history
    this.conversationHistory.push({
      role: 'user',
      content: userResponse,
      timestamp: new Date(),
    });

    // Debug: Log the user response
    logger.info('👤 User Response:', {
      response: userResponse,
      conversationTurn: Math.ceil(this.conversationHistory.length / 2),
      phase: this.currentPhase,
    });

    if (this.currentPhase === 'planning') {
      // Check if we have enough information to proceed to ADR generation
      logger.debug('AgentOrchestrator: Evaluating readiness for ADR generation');
      const readinessEvaluation = await this.planningAgent.evaluateReadiness(
        this.featureRequest,
        this.conversationHistory
      );

      logger.info('📊 Readiness Evaluation:', {
        readyForADR: readinessEvaluation.readyForADR,
        missingInfoCount: readinessEvaluation.missingInformation?.length || 0,
        missingInformation: readinessEvaluation.missingInformation || [],
        reasoning: readinessEvaluation.reasoning,
      });

      if (readinessEvaluation.readyForADR) {
        // Transition to ADR generation phase
        this.currentPhase = 'adr_generation';
        logger.info('✅ Planning Complete - Ready for ADR Generation');
        return {
          type: 'phase_transition',
          message: 'Planning phase complete. Generating ADR...',
          readinessEvaluation,
        };
      } else {
        // Continue with planning questions
        logger.info('❓ Continue Planning - More information needed');
        return await this.getNextPlanningQuestion();
      }
    }

    throw new Error(`Invalid phase: ${this.currentPhase}`);
  }

  async getNextPlanningQuestion(onChunk = null) {
    try {
      logger.debug('AgentOrchestrator: Getting next planning question', {
        conversationHistoryLength: this.conversationHistory.length,
        featureRequestLength: this.featureRequest?.length || 0,
        codebaseContextLength: this.codebaseContext?.length || 0,
        streaming: !!onChunk,
      });

      const response = await this.planningAgent.askQuestion(
        this.featureRequest,
        this.conversationHistory,
        this.codebaseContext,
        onChunk
      );

      if (response.success) {
        logger.debug('AgentOrchestrator: Planning agent returned successful response', {
          dataKeys: Object.keys(response.data || {}),
          hasBodyText: !!response.data?.bodyText,
          hasOptionText: !!response.data?.optionText,
        });

        // Add the AI question to history
        const aiMessage = {
          role: 'assistant',
          content:
            response.data.bodyText +
            (response.data.optionText ? `\n\n${response.data.optionText}` : ''),
          timestamp: new Date(),
        };
        this.conversationHistory.push(aiMessage);

        // Debug: Log the AI question and options
        logger.info('🤖 AI Question:', {
          header: response.data.header,
          question: response.data.optionText,
          optionsCount: response.data.options?.length || 0,
          options:
            response.data.options?.map(
              (opt, idx) => `${idx + 1}. ${opt.title}${opt.recommended ? ' ⭐ RECOMMENDED' : ''}`
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
      logger.errorWithStack(error, 'AgentOrchestrator: Failed to get next planning question', {
        conversationHistoryLength: this.conversationHistory.length,
        currentPhase: this.currentPhase,
      });
      // Re-throw without modification in debug mode to preserve stack trace
      throw error;
    }
  }

  async generateADR() {
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
      throw new Error(`Failed to generate ADR: ${error.message}`);
    }
  }

  async generateDetailedImplementation(adrContent) {
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
      throw new Error(`Failed to generate implementation steps: ${error.message}`);
    }
  }

  // Utility methods
  getCurrentPhase() {
    return this.currentPhase;
  }

  getConversationHistory() {
    return this.conversationHistory;
  }

  getFeatureRequest() {
    return this.featureRequest;
  }

  // Export conversation for session management
  exportSession() {
    return {
      featureRequest: this.featureRequest,
      codebaseContext: this.codebaseContext,
      conversationHistory: this.conversationHistory,
      currentPhase: this.currentPhase,
      timestamp: new Date(),
    };
  }

  // Import conversation from saved session
  importSession(sessionData) {
    this.featureRequest = sessionData.featureRequest || '';
    this.codebaseContext = sessionData.codebaseContext || '';
    this.conversationHistory = sessionData.conversationHistory || [];
    this.currentPhase = sessionData.currentPhase || 'planning';
  }

  // Reset for new feature planning
  reset() {
    this.conversationHistory = [];
    this.currentPhase = 'planning';
    this.featureRequest = '';
    this.codebaseContext = '';
  }

  // Get a summary of the planning session
  getPlanningSessionSummary() {
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
