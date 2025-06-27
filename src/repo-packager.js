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

      spinner.succeed('Repository packed successfully');

      // Show repomix output summary
      this.showRepomixSummary(content);

      // Clean up the output file
      await fs.remove(this.outputFile);

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

  showRepomixSummary(content) {
    console.log(chalk.blue('\n📦 Repomix Summary:'));

    // Extract basic statistics from content
    const lines = content.split('\n');
    const totalLines = lines.length;

    // Count files (look for file headers like "==== path/to/file.ext ====")
    const fileMatches = content.match(/====\s*[^=]+\s*====/g) || [];
    const fileCount = fileMatches.length;

    // Estimate token count (rough approximation: 1 token ≈ 4 characters)
    const estimatedTokens = Math.round(content.length / 4);

    // Get file size in KB
    const sizeKB = Math.round(content.length / 1024);

    console.log(chalk.gray(`  Files processed: ${fileCount}`));
    console.log(chalk.gray(`  Total lines: ${totalLines.toLocaleString()}`));
    console.log(chalk.gray(`  Content size: ${sizeKB} KB`));
    console.log(chalk.gray(`  Estimated tokens: ${estimatedTokens.toLocaleString()}`));

    // Show first few files for confirmation
    if (fileMatches.length > 0) {
      console.log(chalk.gray('  Sample files:'));
      const sampleFiles = fileMatches.slice(0, 3).map(match => {
        const fileName = match.replace(/=/g, '').trim();
        return `    • ${fileName}`;
      });
      console.log(chalk.gray(sampleFiles.join('\n')));

      if (fileMatches.length > 3) {
        console.log(chalk.gray(`    ... and ${fileMatches.length - 3} more files`));
      }
    }

    console.log();
  }
}
