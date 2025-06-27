import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';

export class ChatSession {
  constructor(model, options = {}) {
    this.model = model;
    this.chatSession = null;
    this.streamingEnabled = options.streaming !== false; // Default to true
    this.typingSpeed = options.typingSpeed || 'normal';

    // Track chat history manually for session persistence
    this.chatHistory = [];

    // Initialize feature data structure
    this.featureData = {
      name: '',
      description: '',
      requirements: [],
      decisions: [],
      implementation_plan: '',
      adr_content: '',
      adrFilename: '',
      adr_title: '',
    };
  }

  async initialize(codebaseContent, sessionData = null) {
    if (sessionData) {
      // Resuming from existing session
      this.featureData = sessionData.featureData;
      this.chatHistory = sessionData.chatHistory || [];

      const spinner = ora('Restoring conversation context...').start();

      try {
        this.chatSession = this.model.startChat({
          history: this.chatHistory,
          generationConfig: {
            temperature: 0.7,
          },
        });

        spinner.succeed('Session restored successfully');
        console.log(chalk.green(`📝 Resuming: ${this.featureData.name || 'Unnamed Feature'}`));
        if (this.featureData.description) {
          console.log(chalk.gray(`Description: ${this.featureData.description}`));
        }
        console.log();

        return 'Session restored';
      } catch (error) {
        spinner.fail('Failed to restore session');
        throw error;
      }
    } else {
      // Starting new session
      const systemPrompt = `You are a tech lead focused on software architecture and feature planning.

I will give you access to my codebase. Your job is to:

1. Analyze the current state of the codebase to understand relevant modules, structure, technologies, and existing constraints.

2. For each feature I want to build:
   - Ask precise, clarifying questions until you have full understanding of the desired behavior, edge cases, and data flows.
   - Generate an ADR (Architecture Decision Record) detailing the chosen approach, rejected alternatives, and reasoning.
   - Produce a step-by-step implementation plan, including file/module changes, interface updates, and any migrations or tests.

Important guidelines:
- Do not assume the presence of users or business context; focus purely on product design and technical implementation.
- Always identify and describe trade-offs in implementation choices.
- Prefer clarity and modularity over optimization.
- Break down large changes into shippable, isolated steps.
- Where appropriate, propose code stubs or schemas to facilitate discussion.
- Ask ONE clarifying question at a time, and provide options when relevant.
- Always provide your recommendation when presenting options.

Here is the codebase content:

\`\`\`
${codebaseContent}
\`\`\`

Please analyze the codebase first, then confirm you're ready to help me plan a feature. Provide a brief summary of what you understand about the current architecture and technologies used.`;

      const spinner = ora('Analyzing codebase...').start();

      try {
        this.chatSession = this.model.startChat({
          history: [],
          generationConfig: {
            temperature: 0.7,
          },
        });

        // Add system prompt to history
        this.chatHistory.push({
          role: 'user',
          parts: [{ text: systemPrompt }],
        });

        const result = await this.chatSession.sendMessageStream(systemPrompt);

        // Stop spinner and prepare for streaming
        spinner.succeed('Codebase analyzed');
        console.log(chalk.blue('🤖 AI Analysis:'));

        let response = '';

        // Stream the response
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          process.stdout.write(chalk.gray(chunkText));
          response += chunkText;
        }

        // Add AI analysis response to history
        this.chatHistory.push({
          role: 'model',
          parts: [{ text: response }],
        });

        console.log(); // Add newline after streaming
        console.log();

        return response;
      } catch (error) {
        spinner.fail('Failed to analyze codebase');
        throw error;
      }
    }
  }

  async conductFeaturePlanning(sessionManager, sessionName = null) {
    // Check if this session already has a completed ADR
    if (sessionName && this.featureData.adr_content) {
      console.log(chalk.blue('This session already has a completed ADR!'));
      console.log(chalk.gray(`Feature: ${this.featureData.description}`));
      console.log(chalk.gray(`ADR: ${this.featureData.adr_title || this.featureData.name}`));
      console.log();

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📖 Review the current ADR content', value: 'review' },
            { name: '✏️  Make changes or refinements to the ADR', value: 'modify' },
            { name: '✅ Exit (ADR is complete)', value: 'exit' },
          ],
        },
      ]);

      if (action === 'exit') {
        console.log(chalk.green('Session complete. Exiting.'));
        return this.featureData;
      } else if (action === 'review') {
        console.log(chalk.blue('\n📖 Current ADR Content:'));
        console.log(chalk.gray('='.repeat(80)));
        console.log(this.featureData.adr_content);
        console.log(chalk.gray('='.repeat(80)));
        console.log();

        // After reviewing, ask if they want to make changes
        const { afterReview } = await inquirer.prompt([
          {
            type: 'list',
            name: 'afterReview',
            message: 'After reviewing, what would you like to do?',
            choices: [
              { name: '✏️  Make changes or refinements', value: 'modify' },
              { name: '✅ Exit (no changes needed)', value: 'exit' },
            ],
          },
        ]);

        if (afterReview === 'exit') {
          console.log(chalk.green('No changes needed. Exiting.'));
          return this.featureData;
        } else {
          // Continue to modification flow
          return await this.conductADRModification(sessionManager, sessionName);
        }
      } else if (action === 'modify') {
        return await this.conductADRModification(sessionManager, sessionName);
      }
    }

    console.log(chalk.green('Ready to start feature planning!'));
    console.log(chalk.gray('Type your feature description or type "done" when finished.'));
    console.log();

    // If resuming session and already have feature data, skip initial prompt
    let featureDescription;
    if (sessionName && this.featureData.description && !this.featureData.adr_content) {
      featureDescription = this.featureData.description;
      console.log(chalk.green(`Continuing with feature: ${this.featureData.description}`));
    } else {
      // Get initial feature description
      const { featureDescription: userInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'featureDescription',
          message: 'What feature would you like to build?',
          validate: input => input.trim() !== '' || 'Please provide a feature description',
        },
      ]);

      featureDescription = userInput;
      this.featureData.name = this.extractFeatureName(featureDescription);
      this.featureData.description = featureDescription;

      // Generate session name if this is a new session
      if (!sessionName) {
        sessionName = sessionManager.generateSessionName(featureDescription);
      }
    }

    console.log(chalk.blue('\n🤖 Starting interactive planning session...'));
    console.log(
      chalk.gray(
        'The AI will ask clarifying questions. Answer them to refine the feature requirements.'
      )
    );
    console.log();

    // Send initial feature description to AI
    let aiResponse = await this.sendMessage(
      `I want to build this feature: ${featureDescription}. Please ask me your first clarifying question and provide options where relevant.`
    );

    // Interactive Q&A loop
    let planningComplete = false;
    while (!planningComplete) {
      // aiResponse is already displayed by sendMessage (streaming)
      console.log();

      const { userResponse } = await inquirer.prompt([
        {
          type: 'input',
          name: 'userResponse',
          message: 'Your response (or "done" to finish):',
          validate: input => input.trim() !== '' || 'Please provide a response',
        },
      ]);

      if (userResponse.toLowerCase() === 'done') {
        planningComplete = true;
        break;
      }

      // Store user response in requirements
      this.featureData.requirements.push(userResponse);

      // Get next AI question or final summary
      aiResponse = await this.sendMessage(userResponse);

      // Save session after each user response
      if (sessionManager && sessionName) {
        try {
          await sessionManager.saveSession(sessionName, this.featureData, this.chatHistory);
        } catch {
          console.warn(chalk.yellow('⚠️  Warning: Failed to save session data'));
        }
      }

      // Check if AI is ready to generate ADR
      const lowerResponse = aiResponse.toLowerCase();
      if (
        lowerResponse.includes('generate the adr') ||
        lowerResponse.includes('ready to create') ||
        lowerResponse.includes('implementation plan')
      ) {
        const { proceedToADR } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceedToADR',
            message: 'Are you ready to generate the ADR and implementation plan?',
            default: true,
          },
        ]);

        if (proceedToADR) {
          planningComplete = true;
          break;
        }
      }
    }

    // Generate the final ADR
    console.log(chalk.yellow('\n📝 Generating Architecture Decision Record...'));
    const adrResponse = await this.sendMessage(
      `Based on our conversation, please generate a comprehensive Architecture Decision Record (ADR) for the "${this.featureData.name}" feature.

First, create a clear, concise title for this ADR that captures the essence of the architectural decision (not just the feature name). The title should be in the format: "[Action/Decision] [Technology/Component] for [Purpose]"

Then use this exact format:

# ADR: [Number] - [Your Generated Title]

## Status
Proposed

## Context
[Brief context about the feature and why it's needed]

## Decision
[The architectural decision made]

## Consequences
[Positive and negative consequences]

## Implementation Plan
[Step-by-step implementation plan with specific files/modules to change]

## Alternatives Considered
[Alternative approaches that were considered and why they were rejected]

Remember: The title should reflect the architectural decision, not just the feature name. For example:
- "Implement JWT Authentication for User Management"
- "Adopt Microservices Architecture for Payment Processing"
- "Use Redis Caching for Session Management"`
    );

    this.featureData.adr_content = adrResponse;
    this.featureData.implementation_plan = this.extractImplementationPlan(adrResponse);
    this.featureData.adr_title = this.extractADRTitle(adrResponse);
    this.featureData.adrFilename = this.generateADRFilename(
      this.featureData.adr_title || this.featureData.name
    );

    // Save final session state
    if (sessionManager && sessionName) {
      try {
        await sessionManager.saveSession(sessionName, this.featureData, this.chatHistory);
      } catch {
        console.warn(chalk.yellow('⚠️  Warning: Failed to save final session data'));
      }
    }

    return this.featureData;
  }

  async sendMessage(message) {
    const spinner = ora('AI is thinking...').start();

    try {
      // Add user message to history
      this.chatHistory.push({
        role: 'user',
        parts: [{ text: message }],
      });

      const result = await this.chatSession.sendMessageStream(message);

      // Stop spinner and prepare for streaming
      spinner.stop();
      console.log(chalk.blue('🤖 AI:'));

      let fullResponse = '';
      let isFirstChunk = true;

      // Stream the response with slight delays for better UX
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();

        if (isFirstChunk) {
          // Small delay before starting to type
          await this.sleep(200);
          isFirstChunk = false;
        }

        // Configure typing speed based on settings
        const speeds = {
          fast: { charDelay: 5, chunkDelay: 20 },
          normal: { charDelay: 10, chunkDelay: 50 },
          slow: { charDelay: 20, chunkDelay: 100 },
        };

        const currentSpeed = speeds[this.typingSpeed] || speeds.normal;

        // Type out character by character for shorter chunks, or just output for longer ones
        if (this.streamingEnabled && chunkText.length < 50) {
          for (const char of chunkText) {
            process.stdout.write(char);
            await this.sleep(currentSpeed.charDelay);
          }
        } else {
          process.stdout.write(chunkText);
          if (this.streamingEnabled) {
            await this.sleep(currentSpeed.chunkDelay);
          }
        }

        fullResponse += chunkText;
      }

      // Add AI response to history
      this.chatHistory.push({
        role: 'model',
        parts: [{ text: fullResponse }],
      });

      console.log(); // Add newline after streaming
      return fullResponse;
    } catch (error) {
      spinner.fail('Failed to get AI response');
      throw error;
    }
  }

  // Utility function for delays
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  extractFeatureName(description) {
    // Simple extraction - take first few words and make it filename-safe
    return description
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '') // remove special chars but keep spaces and hyphens
      .trim()
      .split(/\s+/)
      .slice(0, 5) // Increased to 5 words
      .join('-')
      .replace(/-+/g, '-'); // Collapse multiple hyphens
  }

  extractImplementationPlan(adrContent) {
    const planMatch = adrContent.match(/## Implementation Plan\s*([\s\S]*?)(?=## |$)/);
    return planMatch ? planMatch[1].trim() : '';
  }

  extractADRTitle(adrContent) {
    // Extract title from ADR content - look for the pattern "# ADR: [Number] - [Title]"
    const titleMatch = adrContent.match(/# ADR:\s*\d+\s*-\s*(.+)/);
    if (titleMatch) {
      return titleMatch[1].trim();
    }

    // Fallback: look for any markdown header that looks like a title
    const headerMatch = adrContent.match(/^#\s*(.+)$/m);
    if (headerMatch) {
      return headerMatch[1].trim().replace(/^ADR:\s*\d*\s*-?\s*/, '');
    }

    return null;
  }

  generateADRFilename(featureName) {
    const timestamp = new Date().toISOString().split('T')[0];
    const safeFeatureName = featureName
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join('-')
      .replace(/-+/g, '-');
    return `${timestamp}-${safeFeatureName}.md`;
  }

  async conductADRModification(sessionManager, sessionName) {
    console.log(chalk.blue('\n✏️  ADR Modification Mode'));
    console.log(
      chalk.gray(
        'You can ask questions about the current ADR, request changes, or explore alternatives.'
      )
    );
    console.log(chalk.gray('Type "done" when you are finished with modifications.'));
    console.log();

    // Inform the AI about the current state and what we want to do
    await this.sendMessage(
      `I would like to review and potentially modify the current ADR. Here is the current ADR content:

${this.featureData.adr_content}

I may want to make changes, explore alternatives, or ask questions about this ADR. Please help me refine it based on my feedback.`
    );

    // Interactive modification loop
    let modificationComplete = false;
    while (!modificationComplete) {
      console.log();

      const { userInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'userInput',
          message: 'What changes or questions do you have about the ADR? (or "done" to finish):',
          validate: input => input.trim() !== '' || 'Please provide your feedback or type "done"',
        },
      ]);

      if (userInput.toLowerCase() === 'done') {
        modificationComplete = true;
        break;
      }

      // Send user feedback to AI
      await this.sendMessage(userInput);

      // Save session after each modification interaction
      if (sessionManager && sessionName) {
        try {
          await sessionManager.saveSession(sessionName, this.featureData, this.chatHistory);
        } catch {
          console.warn(chalk.yellow('⚠️  Warning: Failed to save session data'));
        }
      }
    }

    // Ask if user wants to update the ADR with the modifications
    const { updateADR } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'updateADR',
        message: 'Would you like to generate an updated ADR based on our discussion?',
        default: true,
      },
    ]);

    if (!updateADR) {
      console.log(chalk.yellow('No changes made to the ADR. Original version preserved.'));
      return this.featureData;
    }

    // Generate updated ADR
    console.log(chalk.yellow('\n📝 Generating updated ADR...'));
    const updatedAdrResponse = await this.sendMessage(
      `Based on our discussion and feedback, please generate an updated version of the ADR. Use the same format as before:

# ADR: [Number] - [Title]

## Status
[Status]

## Context
[Updated context]

## Decision
[Updated decision]

## Consequences
[Updated consequences]

## Implementation Plan
[Updated implementation plan]

## Alternatives Considered
[Updated alternatives]

Make sure to incorporate all the changes and improvements we discussed.`
    );

    // Update feature data with the new ADR content
    this.featureData.adr_content = updatedAdrResponse;
    this.featureData.implementation_plan = this.extractImplementationPlan(updatedAdrResponse);
    this.featureData.adr_title = this.extractADRTitle(updatedAdrResponse);
    this.featureData.adrFilename = this.generateADRFilename(
      this.featureData.adr_title || this.featureData.name
    );

    // Save final updated session state
    if (sessionManager && sessionName) {
      try {
        await sessionManager.saveSession(sessionName, this.featureData, this.chatHistory);
        console.log(chalk.green('\n✅ ADR updated and session saved successfully!'));
      } catch {
        console.warn(chalk.yellow('⚠️  Warning: Failed to save final session data'));
      }
    }

    return this.featureData;
  }
}
