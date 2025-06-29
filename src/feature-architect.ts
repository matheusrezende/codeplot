import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import path from 'path';
import { RepoPackager } from './repo-packager.js';
import { ChatSession } from './chat-session.js';
import { ADRGenerator } from './adr-generator.js';
import { AgentOrchestrator } from './agents/AgentOrchestrator.js';

interface FeatureArchitectOptions {
  projectPath: string;
  apiKey?: string;
  outputDir: string;
  streaming?: boolean;
  typingSpeed?: string;
}

interface FeatureData {
  adrFilename: string;
  adr_content: string;
  adr_title?: string;
  name?: string;
  [key: string]: any;
}

interface CompletionResult {
  success: boolean;
  adrPath: string;
  featureData: FeatureData;
}

@injectable()
export class FeatureArchitect {
  private projectPath: string;
  private apiKey: string;
  private outputDir: string;
  private streaming: boolean;
  private typingSpeed: string;

  public repoPackager: RepoPackager;
  public chatSession: ChatSession;
  public adrGenerator: ADRGenerator;
  public agentOrchestrator: AgentOrchestrator;

  constructor(
    @inject('FeatureArchitectOptions') options: FeatureArchitectOptions,
    @inject(RepoPackager) repoPackager: RepoPackager,
    @inject(ChatSession) chatSession: ChatSession,
    @inject(ADRGenerator) adrGenerator: ADRGenerator,
    @inject(AgentOrchestrator) agentOrchestrator: AgentOrchestrator
  ) {
    this.projectPath = options.projectPath;
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
    this.outputDir = options.outputDir;
    this.streaming = options.streaming !== false; // Default to true
    this.typingSpeed = options.typingSpeed || 'normal';

    if (!this.apiKey) {
      throw new Error(
        'Gemini API key is required. Set GEMINI_API_KEY environment variable or use --api-key option.'
      );
    }

    this.repoPackager = repoPackager;
    this.chatSession = chatSession;
    this.adrGenerator = adrGenerator;
    this.agentOrchestrator = agentOrchestrator;
  }

  async completeSession(featureData: FeatureData): Promise<CompletionResult> {
    try {
      await this.adrGenerator.generate(featureData);

      const adrPath = path.join(this.outputDir, featureData.adrFilename);
      return {
        success: true,
        adrPath,
        featureData,
      };
    } catch (error) {
      throw new Error(`Failed to complete session: ${(error as Error).message}`);
    }
  }
}
