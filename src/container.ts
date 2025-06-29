import { container } from 'tsyringe';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentOrchestrator } from './agents/AgentOrchestrator.js';
import { ADRGeneratorAgent } from './agents/ADRGeneratorAgent.js';
import { PlanningAgent } from './agents/PlanningAgent.js';
import { PRDAgent } from './agents/PRDAgent.js';
import { PRDGeneratorAgent } from './agents/PRDGeneratorAgent.js';
import { FeatureArchitect } from './feature-architect.js';
import { RepoPackager } from './repo-packager.js';
import { ChatSession } from './chat-session.js';
import { ADRGenerator } from './adr-generator.js';

// Function to configure the container with runtime options
export function configureContainer(options: {
  projectPath: string;
  apiKey: string;
  outputDir: string;
  streaming?: boolean;
  typingSpeed?: string;
}) {
  // Register primitive values
  container.register('ProjectPath', { useValue: options.projectPath });
  container.register('ApiKey', { useValue: options.apiKey });
  container.register('OutputDir', { useValue: options.outputDir });
  container.register('ModelName', { useValue: 'gemini-2.5-pro' });

  // Register Google AI model factory
  container.register('GenerativeModel', {
    useFactory: () => {
      const genAI = new GoogleGenerativeAI(options.apiKey);
      return genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
    },
  });

  // Register chat session options
  container.register('ChatSessionOptions', {
    useValue: {
      streaming: options.streaming !== false,
      typingSpeed: options.typingSpeed || 'normal',
    },
  });

  // Register FeatureArchitect options
  container.register('FeatureArchitectOptions', { useValue: options });

  // Register all injectable classes
  container.register(RepoPackager, RepoPackager);
  container.register(ChatSession, ChatSession);
  container.register(ADRGenerator, ADRGenerator);
  container.register(PlanningAgent, PlanningAgent);
  container.register(ADRGeneratorAgent, ADRGeneratorAgent);
  container.register(PRDAgent, PRDAgent);
  container.register(PRDGeneratorAgent, PRDGeneratorAgent);
  container.register(AgentOrchestrator, AgentOrchestrator);
  container.register(FeatureArchitect, FeatureArchitect);
}

export default container;
