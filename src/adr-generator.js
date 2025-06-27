import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';

const execAsync = promisify(exec);

export class ADRGenerator {
  constructor(outputDir) {
    this.outputDir = outputDir;
  }

  async generate(featureData) {
    const spinner = ora('Generating ADR...').start();

    try {
      // Ensure output directory exists
      await fs.ensureDir(this.outputDir);

      // Check if adr-tools is installed
      const hasADRTools = await this.checkADRToolsInstallation();

      if (hasADRTools) {
        return await this.generateWithADRTools(featureData, spinner);
      } else {
        return await this.generateManually(featureData, spinner);
      }
    } catch (error) {
      spinner.fail('Failed to generate ADR');
      throw new Error(`Failed to generate ADR: ${error.message}`);
    }
  }

  async generateWithADRTools(featureData, spinner) {
    try {
      // Initialize ADR directory if it doesn't exist
      await this.initializeADRDirectory();

      // Get the title for adr-tools (remove special characters for command line safety)
      const adrTitle = featureData.adr_title || featureData.name;
      const safeTitleForCommand = adrTitle.replace(/[^a-zA-Z0-9\s-]/g, '').trim();

      // Use adr-tools to create a new ADR
      const docDir = path.join(this.outputDir, '..');
      const adrCommand = `adr new "${safeTitleForCommand}"`;

      spinner.text = 'Creating ADR with adr-tools...';
      const { stdout } = await execAsync(adrCommand, { cwd: docDir });

      // Extract the created filename from adr-tools output
      const filenameMatch = stdout.match(/(\d+-[^\s]+\.md)/);
      let adrPath;

      if (filenameMatch) {
        const generatedFilename = filenameMatch[1];
        adrPath = path.join(this.outputDir, generatedFilename);

        // Replace the template content with our AI-generated content
        await fs.writeFile(adrPath, featureData.adr_content, 'utf-8');

        // Update the filename in featureData to match what adr-tools created
        featureData.adrFilename = generatedFilename;
      } else {
        // Fallback to manual file creation if we can't parse adr-tools output
        adrPath = path.join(this.outputDir, featureData.adrFilename);
        await fs.writeFile(adrPath, featureData.adr_content, 'utf-8');
      }

      spinner.succeed(`ADR generated with adr-tools: ${featureData.adrFilename}`);

      this.showADRSummary(featureData, adrPath);
      return adrPath;
    } catch {
      // Fallback to manual generation if adr-tools fails
      console.log(chalk.yellow('⚠️  adr-tools failed, falling back to manual generation'));
      return await this.generateManually(featureData, spinner);
    }
  }

  async generateManually(featureData, spinner) {
    spinner.text = 'Creating ADR manually...';

    const adrPath = path.join(this.outputDir, featureData.adrFilename);
    await fs.writeFile(adrPath, featureData.adr_content, 'utf-8');

    spinner.succeed(`ADR generated manually: ${featureData.adrFilename}`);

    console.log(chalk.yellow('💡 Consider installing adr-tools for better ADR management:'));
    console.log(chalk.gray('  npm install -g adr-tools'));
    console.log(chalk.gray('  OR'));
    console.log(chalk.gray('  brew install adr-tools (on macOS)'));
    console.log();

    this.showADRSummary(featureData, adrPath);
    return adrPath;
  }

  showADRSummary(featureData, adrPath) {
    console.log(chalk.blue('📋 ADR Summary:'));
    console.log(chalk.gray(`  Title: ${featureData.adr_title || featureData.name}`));
    console.log(chalk.gray(`  Feature: ${featureData.name}`));
    console.log(chalk.gray(`  File: ${adrPath}`));
    console.log(chalk.gray(`  Requirements captured: ${featureData.requirements.length}`));

    if (featureData.implementation_plan) {
      const planLines = featureData.implementation_plan.split('\n').filter(line => line.trim());
      console.log(chalk.gray(`  Implementation steps: ${planLines.length}`));
    }

    console.log();
  }

  async checkADRToolsInstallation() {
    try {
      await execAsync('which adr');
      return true;
    } catch {
      return false;
    }
  }

  async initializeADRDirectory() {
    try {
      // Check if ADR directory is already initialized
      const docDir = path.join(this.outputDir, '..');
      await execAsync('adr init', { cwd: docDir });
    } catch {
      // Directory might already be initialized, or adr-tools not available
      // We'll handle this gracefully
    }
  }
}

export class ManualADRGenerator {
  constructor(outputDir) {
    this.outputDir = outputDir;
  }

  async generate(featureData) {
    await fs.ensureDir(this.outputDir);

    const adrPath = path.join(this.outputDir, featureData.adrFilename);
    await fs.writeFile(adrPath, featureData.adr_content, 'utf-8');

    console.log(chalk.green(`✅ ADR saved to: ${adrPath}`));
    return adrPath;
  }
}
