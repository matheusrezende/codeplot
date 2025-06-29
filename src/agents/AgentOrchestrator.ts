import 'reflect-metadata';
import { injectable, inject, container } from 'tsyringe';
import { DynamicTool } from '@langchain/core/tools';
import { AIMessage, BaseMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { PlanningAgent } from './PlanningAgent';
import { ADRGeneratorAgent } from './ADRGeneratorAgent';
import { PRDAgent } from './PRDAgent';
import { PRDGeneratorAgent } from './PRDGeneratorAgent';
import { MCPToolManager } from '../tools/MCPToolManager.js';
import { PRD } from '../types/prd';

export type WorkflowType = 'adr' | 'prd';

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

interface DocumentResponse {
  type: 'document_generated';
  document: ADRResult | PRD;
  conversationHistory: BaseMessage[];
}

interface SessionData {
  featureRequest: string;
  codebaseContext: string;
  conversationHistory: BaseMessage[];
  currentPhase: string;
  workflow: WorkflowType;
  timestamp: Date;
}

type Phase = 'planning' | 'generation' | 'completed';
const MAX_TURNS = 10;

@injectable()
export class AgentOrchestrator {
  private planningAgent!: PlanningAgent | PRDAgent;
  private generatorAgent!: ADRGeneratorAgent | PRDGeneratorAgent;
  private mcpToolManager: MCPToolManager;
  private conversationHistory: BaseMessage[] = [];
  private currentPhase: Phase = 'planning';
  private featureRequest = '';
  private codebaseContext = '';
  private mcpTools: DynamicTool[] = [];
  private activeWorkflow: WorkflowType = 'adr';

  constructor(@inject(MCPToolManager) mcpToolManager: MCPToolManager) {
    this.mcpToolManager = mcpToolManager;
  }

  setWorkflow(workflow: WorkflowType) {
    this.activeWorkflow = workflow;
    if (workflow === 'adr') {
      this.planningAgent = container.resolve(PlanningAgent);
      this.generatorAgent = container.resolve(ADRGeneratorAgent);
    } else {
      this.planningAgent = container.resolve(PRDAgent);
      this.generatorAgent = container.resolve(PRDGeneratorAgent);
    }
  }

  async startPlanning(
    featureRequest: string,
    codebaseContext: string = ''
  ): Promise<PlanningResponse | { type: 'ready_for_generation' }> {
    this.featureRequest = featureRequest;
    this.codebaseContext = codebaseContext;
    this.mcpTools = await this.mcpToolManager.initializeTools();

    const initialContent = `Feature Request: ${featureRequest}\n\nCodebase Context:\n${codebaseContext}`;
    this.conversationHistory = [new HumanMessage(initialContent)];

    return this.runPlanningLoop();
  }

  async continueConversation(
    userResponse: string
  ): Promise<PlanningResponse | { type: 'ready_for_generation' }> {
    this.conversationHistory.push(new HumanMessage(userResponse));
    return this.runPlanningLoop();
  }

  private async runPlanningLoop(): Promise<PlanningResponse | { type: 'ready_for_generation' }> {
    let turns = 0;
    while (turns < MAX_TURNS) {
      turns++;

      const readinessEvaluation = await this.planningAgent.evaluateReadiness(
        this.conversationHistory
      );
      if (readinessEvaluation.readyForADR) {
        this.currentPhase = 'generation';
        return { type: 'ready_for_generation' };
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

  async generateDocument(): Promise<DocumentResponse> {
    if (this.currentPhase !== 'generation') {
      throw new Error('Not ready for document generation.');
    }

    let document: ADRResult | PRD;

    if (this.activeWorkflow === 'adr') {
      document = await (this.generatorAgent as ADRGeneratorAgent).generateADR(
        this.featureRequest,
        this.conversationHistory,
        this.codebaseContext
      );
    } else {
      document = await (this.generatorAgent as PRDGeneratorAgent).generatePRD(
        this.featureRequest,
        this.conversationHistory
      );
    }

    this.currentPhase = 'completed';

    return {
      type: 'document_generated',
      document,
      conversationHistory: this.conversationHistory,
    };
  }

  exportSession(): SessionData {
    return {
      featureRequest: this.featureRequest,
      codebaseContext: this.codebaseContext,
      conversationHistory: this.conversationHistory,
      currentPhase: this.currentPhase,
      workflow: this.activeWorkflow,
      timestamp: new Date(),
    };
  }

  importSession(sessionData: SessionData): void {
    this.featureRequest = sessionData.featureRequest || '';
    this.codebaseContext = sessionData.codebaseContext || '';
    this.conversationHistory = sessionData.conversationHistory || [];
    this.currentPhase = (sessionData.currentPhase as Phase) || 'planning';
    this.setWorkflow(sessionData.workflow || 'adr');
  }
}
