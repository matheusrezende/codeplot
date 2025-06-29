import 'reflect-metadata';
import { container } from 'tsyringe';
import { AgentOrchestrator } from '../../agents/AgentOrchestrator';
import { PlanningAgent } from '../../agents/PlanningAgent';
import { ADRGeneratorAgent } from '../../agents/ADRGeneratorAgent';

// Create mock classes
class MockPlanningAgent extends PlanningAgent {
  constructor() {
    // Pass dummy values to satisfy the parent constructor
    super('mock-api-key', 'mock-model');
  }

  async askQuestion() {
    return {
      success: true,
      data: {
        header: 'Mock Question',
        bodyText: 'This is a mock question',
        optionText: 'Choose an option:',
        options: [
          { id: '1', title: 'Option 1', description: 'Mock option 1', recommended: true },
          { id: '2', title: 'Option 2', description: 'Mock option 2', recommended: false },
        ],
        readyForADR: false,
      },
    };
  }

  async evaluateReadiness() {
    return {
      readyForADR: true,
      missingInformation: [],
      reasoning: 'Mock evaluation - ready for ADR',
    };
  }
}

class MockADRGeneratorAgent extends ADRGeneratorAgent {
  constructor() {
    // Pass dummy values to satisfy the parent constructor
    super('mock-api-key', 'mock-model');
  }

  async generateADR() {
    return {
      adrContent: '# ADR: Mock Feature\n\n## Context\nMock context\n\n## Decision\nMock decision',
      adrNumber: '001',
      adrTitle: 'Mock Feature',
      implementationPlan: 'Mock implementation plan',
    };
  }
}

describe('AgentOrchestrator', () => {
  beforeEach(() => {
    // Clear the container and register mock implementations
    container.clearInstances();
    container.register<PlanningAgent>(PlanningAgent, { useClass: MockPlanningAgent });
    container.register<ADRGeneratorAgent>(ADRGeneratorAgent, { useClass: MockADRGeneratorAgent });
  });

  afterEach(() => {
    // Clean up after each test
    container.clearInstances();
  });

  it('should start with the planning phase', async () => {
    const orchestrator = container.resolve(AgentOrchestrator);

    const response = await orchestrator.startPlanning(
      'Test feature request',
      'Mock codebase context'
    );

    expect(response.type).toBe('planning_question');
    expect(response.data.header).toBe('Mock Question');
    expect(response.data.options).toHaveLength(2);
    expect(orchestrator.getCurrentPhase()).toBe('planning');
  });

  it('should continue conversation and transition to ADR generation when ready', async () => {
    const orchestrator = container.resolve(AgentOrchestrator);

    // Start planning
    await orchestrator.startPlanning('Test feature request', 'Mock codebase context');

    // Continue conversation - our mock will return readyForADR: true
    const response = await orchestrator.continueConversation('Mock user response');

    expect(response.type).toBe('ready_for_adr');
    expect(orchestrator.getCurrentPhase()).toBe('adr_generation');
  });

  it('should generate ADR when in adr_generation phase', async () => {
    const orchestrator = container.resolve(AgentOrchestrator);

    // Start planning and move to ADR generation
    await orchestrator.startPlanning('Test feature request', 'Mock codebase context');
    await orchestrator.continueConversation('Mock user response');

    // Generate ADR
    const adrResponse = await orchestrator.generateADR();

    expect(adrResponse.type).toBe('adr_generated');
    expect(adrResponse.adr.adrTitle).toBe('Mock Feature');
    expect(adrResponse.adr.adrContent).toContain('# ADR: Mock Feature');
    expect(orchestrator.getCurrentPhase()).toBe('completed');
  });

  it('should export and import session data correctly', () => {
    const orchestrator = container.resolve(AgentOrchestrator);

    // Set some state
    orchestrator.startPlanning('Test feature', 'Test context');

    // Export session
    const sessionData = orchestrator.exportSession();
    expect(sessionData.featureRequest).toBe('Test feature');
    expect(sessionData.codebaseContext).toBe('Test context');
    expect(sessionData.currentPhase).toBe('planning');

    // Create new orchestrator and import session
    const newOrchestrator = container.resolve(AgentOrchestrator);
    newOrchestrator.importSession(sessionData);

    expect(newOrchestrator.getFeatureRequest()).toBe('Test feature');
    expect(newOrchestrator.getCurrentPhase()).toBe('planning');
  });

  it('should reset state correctly', async () => {
    const orchestrator = container.resolve(AgentOrchestrator);

    // Set some state
    await orchestrator.startPlanning('Test feature', 'Test context');
    expect(orchestrator.getFeatureRequest()).toBe('Test feature');
    expect(orchestrator.getCurrentPhase()).toBe('planning');

    // Reset
    orchestrator.reset();

    expect(orchestrator.getFeatureRequest()).toBe('');
    expect(orchestrator.getCurrentPhase()).toBe('planning');
    expect(orchestrator.getConversationHistory()).toHaveLength(0);
  });
});
