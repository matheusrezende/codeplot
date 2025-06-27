import { GoogleGenerativeAI } from '@google/generative-ai';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { RepoPackager } from './repo-packager.js';
import { ChatSession } from './chat-session.js';
import { ADRGenerator } from './adr-generator.js';

const execAsync = promisify(exec);

export class FeatureArchitect {
  constructor(options) {
    this.projectPath = options.projectPath;
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    this.outputDir = options.outputDir;
    this.streaming = options.streaming !== false; // Default to true
    this.typingSpeed = options.typingSpeed || 'normal';
    
    if (!this.apiKey) {
      throw new Error('Gemini API key is required. Set GEMINI_API_KEY environment variable or use --api-key option.');
    }
    
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
    
    this.repoPackager = new RepoPackager(this.projectPath);
    this.chatSession = new ChatSession(this.model, {
      streaming: this.streaming,
      typingSpeed: this.typingSpeed
    });
    this.adrGenerator = new ADRGenerator(this.outputDir);
  }

  async start() {
    console.log(chalk.blue('📊  Codeplot'));
    console.log(chalk.gray('AI-powered feature planning and architecture decisions'));
    console.log();

    try {
      // Step 1: Pack the repository
      console.log(chalk.yellow('📦 Step 1: Packing repository with repomix...'));
      const codebaseContent = await this.repoPackager.pack();
      console.log(chalk.green('✅ Repository packed successfully'));
      console.log();

      // Step 2: Initialize AI with codebase
      console.log(chalk.yellow('🤖 Step 2: Initializing AI with codebase analysis...'));
      await this.chatSession.initialize(codebaseContent);
      console.log(chalk.green('✅ AI initialized and ready'));
      console.log();

      // Step 3: Interactive feature planning
      console.log(chalk.yellow('💬 Step 3: Interactive feature planning session'));
      console.log(chalk.gray('The AI will ask you clarifying questions to understand your feature requirements.'));
      console.log();

      const featureData = await this.chatSession.conductFeaturePlanning();

      // Step 4: Generate ADR
      console.log(chalk.yellow('📝 Step 4: Generating Architecture Decision Record...'));
      await this.adrGenerator.generate(featureData);
      console.log(chalk.green('✅ ADR generated successfully'));
      console.log();

      console.log(chalk.blue('🎉 Feature planning completed!'));
      console.log(chalk.gray(`ADR saved to: ${path.join(this.outputDir, featureData.adrFilename)}`));

    } catch (error) {
      console.error(chalk.red('❌ Error during feature planning:'), error.message);
      throw error;
    }
  }
}
