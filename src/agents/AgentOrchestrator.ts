import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { DynamicTool } from '@langchain/core/tools';
import { AIMessage, BaseMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { PlanningAgent } from './PlanningAgent';
import { ADRGeneratorAgent } from './ADRGeneratorAgent';
import { MCPToolManager } from '../tools/MCPToolManager.js';
import { logger } from '../utils/logger';

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
  conversationHistory: BaseMessage[];
}

interface ADRResponse {
  type: 'adr_generated';
  adr: ADRResult;
  conversationHistory: BaseMessage[];
}

interface SessionData {
  featureRequest: string;
  codebaseContext: string;
  conversationHistory: BaseMessage[];
  currentPhase: string;
  timestamp: Date;
}

type Phase = 'planning' | 'adr_generation' | 'completed';

const MAX_TURNS = 10;

@injectable()
export class AgentOrchestrator {
  private planningAgent: PlanningAgent;
  private adrGeneratorAgent: ADRGeneratorAgent;
  private mcpToolManager: MCPToolManager;
  private conversationHistory: BaseMessage[] = [];
  private currentPhase: Phase = 'planning';
  private featureRequest = '';
  private codebaseContext = '';
  private mcpTools: DynamicTool[] = [];

  constructor(
    @inject(PlanningAgent) planningAgent: PlanningAgent,
    @inject(ADRGeneratorAgent) adrGeneratorAgent: ADRGeneratorAgent,
    @inject(MCPToolManager) mcpToolManager: MCPToolManager
  ) {
    this.planningAgent = planningAgent;
    this.adrGeneratorAgent = adrGeneratorAgent;
    this.mcpToolManager = mcpToolManager;
  }

  async startPlanning(
    featureRequest: string,
    codebaseContext: string = ''
  ): Promise<PlanningResponse> {
    this.featureRequest = featureRequest;
    this.codebaseContext = codebaseContext;
    this.mcpTools = await this.mcpToolManager.initializeTools();

    const initialContent = `Feature Request: ${featureRequest}\n\nCodebase Context:\n${codebaseContext}`;
    this.conversationHistory = [new HumanMessage(initialContent)];

    logger.debug('AgentOrchestrator: Starting planning', {
      featureRequestLength: featureRequest.length,
      codebaseContextLength: codebaseContext.length,
      mcpToolCount: this.mcpTools.length,
    });

    return this.getNextPlanningQuestion();
  }

  async continueConversation(
    userResponse: string
  ): Promise<PlanningResponse | { type: 'ready_for_adr' }> {
    this.conversationHistory.push(new HumanMessage(userResponse));
    return this.runPlanningLoop();
  }

  private async runPlanningLoop(): Promise<PlanningResponse | { type: 'ready_for_adr' }> {
    let turns = 0;
    while (turns < MAX_TURNS) {
      turns++;

      const readinessEvaluation = await this.planningAgent.evaluateReadiness(
        this.conversationHistory
      );
      if (readinessEvaluation.readyForADR) {
        this.currentPhase = 'adr_generation';
        return { type: 'ready_for_adr' };
      }

      const response: AIMessage = await this.planningAgent.askQuestion(
        this.conversationHistory,
        this.mcpTools
      );

      this.conversationHistory.push(response);

      if (response.tool_calls && response.tool_calls.length > 0) {
        const toolMessages = await this.executeToolCalls(response);
        this.conversationHistory.push(...toolMessages);
        continue;
      }

      return this.processFinalResponse(response);
    }

    throw new Error('Maximum conversation turns reached.');
  }

  private async executeToolCalls(response: AIMessage): Promise<ToolMessage[]> {
    const toolMessages: ToolMessage[] = [];
    if (!response.tool_calls) return toolMessages;

    for (const toolCall of response.tool_calls) {
      const tool = this.mcpTools.find(t => t.name === toolCall.name);
      if (tool) {
        const toolOutput = await tool.invoke(toolCall.args);
        toolMessages.push(
          new ToolMessage({
            content: toolOutput,
            tool_call_id: toolCall.id!,
          })
        );
      }
    }
    return toolMessages;
  }

  private processFinalResponse(response: AIMessage): PlanningResponse {
    const parsed = this.planningAgent.parseResponse(response.content as string);

    if (!parsed.success || !parsed.data) {
      throw new Error(`Failed to parse agent response: ${parsed.error}`);
    }

    return {
      type: 'planning_question',
      data: parsed.data,
      conversationHistory: this.conversationHistory,
    };
  }

  private async getNextPlanningQuestion(): Promise<PlanningResponse> {
    const response = await this.runPlanningLoop();
    if (response.type === 'ready_for_adr') {
      throw new Error('Agent is ready for ADR, but another question was requested.');
    }
    return response;
  }

  async generateADR(): Promise<ADRResponse> {
    if (this.currentPhase !== 'adr_generation') {
      throw new Error('Not ready for ADR generation.');
    }

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
  }

  exportSession(): SessionData {
    return {
      featureRequest: this.featureRequest,
      codebaseContext: this.codebaseContext,
      conversationHistory: this.conversationHistory,
      currentPhase: this.currentPhase,
      timestamp: new Date(),
    };
  }

  importSession(sessionData: SessionData): void {
    this.featureRequest = sessionData.featureRequest || '';
    this.codebaseContext = sessionData.codebaseContext || '';
    this.conversationHistory = sessionData.conversationHistory || [];
    this.currentPhase = (sessionData.currentPhase as Phase) || 'planning';
  }
}
