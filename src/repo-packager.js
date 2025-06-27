import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';

const execAsync = promisify(exec);

export class RepoPackager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.outputFile = path.join(projectPath, 'repomix-output.txt');
  }

  async pack() {
    const spinner = ora('Packing repository with repomix...').start();

    try {
      // Check if repomix is installed
      await this.checkRepomixInstallation();

      // Run repomix
      const command = `repomix --output "${this.outputFile}"`;
      await execAsync(command, { cwd: this.projectPath });

      // Read the packed content
      const content = await fs.readFile(this.outputFile, 'utf-8');

      // Clean up the output file
      await fs.remove(this.outputFile);

      spinner.succeed('Repository packed successfully');
      return content;
    } catch (error) {
      spinner.fail('Failed to pack repository');

      if (error.message.includes('repomix: command not found')) {
        console.log(chalk.yellow('⚠️  repomix is not installed. Installing it now...'));
        await this.installRepomix();
        return this.pack(); // Retry after installation
      }

      throw new Error(`Failed to pack repository: ${error.message}`);
    }
  }

  async checkRepomixInstallation() {
    try {
      await execAsync('which repomix');
    } catch {
      throw new Error('repomix: command not found');
    }
  }

  async installRepomix() {
    const spinner = ora('Installing repomix...').start();

    try {
      await execAsync('npm install -g repomix');
      spinner.succeed('repomix installed successfully');
    } catch (error) {
      spinner.fail('Failed to install repomix');
      throw new Error(`Failed to install repomix: ${error.message}`);
    }
  }
}
