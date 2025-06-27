import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';
import path from 'path';
import { RepoPackager } from './repo-packager.js';
import { ChatSession } from './chat-session.js';
import { ADRGenerator } from './adr-generator.js';
import { SessionManager } from './session-manager.js';

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
  }

  async start() {
    console.log(chalk.blue('📊  Codeplot'));
    console.log(chalk.gray('AI-powered feature planning and architecture decisions'));
    console.log();

    try {
      // Handle session selection
      let sessionData = null;
      let sessionName = null;

      if (this.sessionPath) {
        // Direct session path provided via --session flag
        console.log(chalk.yellow(`📂 Loading session from: ${this.sessionPath}`));
        sessionData = await this.sessionManager.loadSession(this.sessionPath);
        sessionName = path.basename(this.sessionPath, '.json');
        console.log(chalk.green('✅ Session loaded successfully'));
        console.log();
      } else {
        // Interactive session selection
        const sessionChoice = await this.sessionManager.promptUserForSession();
        if (sessionChoice.type === 'resume') {
          sessionData = sessionChoice.sessionData;
          sessionName = sessionChoice.sessionName;
          console.log(chalk.green(`✅ Resuming session: ${sessionName}`));
          console.log();
        }
      }

      // Step 1: Pack the repository
      console.log(chalk.yellow('📦 Step 1: Packing repository with repomix...'));
      const codebaseContent = await this.repoPackager.pack();
      console.log(chalk.green('✅ Repository packed successfully'));
      console.log();

      // Step 2: Initialize AI with codebase (and session data if resuming)
      console.log(chalk.yellow('🤖 Step 2: Initializing AI with codebase analysis...'));
      await this.chatSession.initialize(codebaseContent, sessionData);
      console.log(chalk.green('✅ AI initialized and ready'));
      console.log();

      // Step 3: Interactive feature planning
      if (sessionData) {
        console.log(chalk.yellow('💬 Step 3: Resuming interactive feature planning session'));
        console.log(chalk.gray('Continuing from where you left off...'));
      } else {
        console.log(chalk.yellow('💬 Step 3: Interactive feature planning session'));
        console.log(
          chalk.gray(
            'The AI will ask you clarifying questions to understand your feature requirements.'
          )
        );
      }
      console.log();

      const featureData = await this.chatSession.conductFeaturePlanning(
        this.sessionManager,
        sessionName
      );

      // Step 4: Generate ADR
      console.log(chalk.yellow('📝 Step 4: Generating Architecture Decision Record...'));
      await this.adrGenerator.generate(featureData);
      console.log(chalk.green('✅ ADR generated successfully'));
      console.log();

      console.log(chalk.blue('🎉 Feature planning completed!'));
      console.log(
        chalk.gray(`ADR saved to: ${path.join(this.outputDir, featureData.adrFilename)}`)
      );
    } catch (error) {
      console.error(chalk.red('❌ Error during feature planning:'), error.message);
      throw error;
    }
  }
}
