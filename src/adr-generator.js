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
      await this.checkADRToolsInstallation();
      
      // Initialize ADR directory if it doesn't exist
      await this.initializeADRDirectory();
      
      // Create the ADR file
      const adrPath = path.join(this.outputDir, featureData.adrFilename);
      await fs.writeFile(adrPath, featureData.adr_content, 'utf-8');
      
      spinner.succeed(`ADR generated: ${featureData.adrFilename}`);
      
      // Show summary
      console.log(chalk.blue('📋 ADR Summary:'));
      console.log(chalk.gray(`Feature: ${featureData.name}`));
      console.log(chalk.gray(`File: ${adrPath}`));
      console.log(chalk.gray(`Requirements captured: ${featureData.requirements.length}`));
      console.log();
      
      return adrPath;
      
    } catch (error) {
      spinner.fail('Failed to generate ADR');
      
      if (error.message.includes('adr: command not found')) {
        console.log(chalk.yellow('⚠️  adr-tools is not installed. You can install it with:'));
        console.log(chalk.gray('npm install -g adr-tools'));
        console.log(chalk.gray('OR'));
        console.log(chalk.gray('brew install adr-tools (on macOS)'));
        console.log();
        console.log(chalk.blue('📝 ADR content saved to file anyway:'));
        
        // Save the file even without adr-tools
        const adrPath = path.join(this.outputDir, featureData.adrFilename);
        await fs.writeFile(adrPath, featureData.adr_content, 'utf-8');
        console.log(chalk.gray(`File: ${adrPath}`));
        
        return adrPath;
      }
      
      throw new Error(`Failed to generate ADR: ${error.message}`);
    }
  }

  async checkADRToolsInstallation() {
    try {
      await execAsync('which adr');
    } catch (error) {
      throw new Error('adr: command not found');
    }
  }

  async initializeADRDirectory() {
    try {
      // Check if ADR directory is already initialized
      const docDir = path.join(this.outputDir, '..');
      await execAsync('adr init', { cwd: docDir });
    } catch (error) {
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
