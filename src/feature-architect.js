import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { RepoPackager } from './repo-packager.js';
import { ChatSession } from './chat-session.js';
import { ADRGenerator } from './adr-generator.js';
import { SessionManager } from './session-manager.js';
import { SessionStateMachine } from './session-state-machine.js';

export class FeatureArchitect {
  constructor(options) {
    this.projectPath = options.projectPath;
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    this.outputDir = options.outputDir;
    this.sessionPath = options.session; // Direct session path from --session flag
    this.streaming = options.streaming !== false; // Default to true
    this.typingSpeed = options.typingSpeed || 'normal';

    if (!this.apiKey) {
      throw new Error(
        'Gemini API key is required. Set GEMINI_API_KEY environment variable or use --api-key option.'
      );
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    this.repoPackager = new RepoPackager(this.projectPath);
    this.chatSession = new ChatSession(this.model, {
      streaming: this.streaming,
      typingSpeed: this.typingSpeed,
    });
    this.adrGenerator = new ADRGenerator(this.outputDir);
    this.sessionManager = new SessionManager(this.projectPath);
    this.stateMachine = null;
  }

  createStateMachine() {
    if (!this.stateMachine) {
      this.stateMachine = new SessionStateMachine(
        this.sessionManager,
        this.repoPackager,
        this.chatSession
      );
    }
    return this.stateMachine;
  }

  async completeSession(featureData) {
    try {
      // Transition to COMPLETED state
      if (this.stateMachine) {
        await this.stateMachine.transitionTo(this.stateMachine.states.COMPLETED);
        await this.stateMachine.saveState();
      }

      // Generate ADR file
      await this.adrGenerator.generate(featureData);

      const adrPath = path.join(this.outputDir, featureData.adrFilename);
      return {
        success: true,
        adrPath,
        featureData,
      };
    } catch (error) {
      throw new Error(`Failed to complete session: ${error.message}`);
    }
  }
}
