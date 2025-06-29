import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs-extra';

const execAsync = promisify(exec);

interface PackSummary {
  fileCount: number;
  totalLines: number;
  sizeKB: number;
  estimatedTokens: number;
  sampleFiles: string[];
  hasMoreFiles: boolean;
  remainingCount: number;
}

interface PackResult {
  content: string;
  summary: PackSummary;
}

@injectable()
export class RepoPackager {
  public projectPath: string;
  private outputFile: string;

  constructor(@inject('ProjectPath') projectPath: string) {
    this.projectPath = projectPath;
    this.outputFile = path.join(projectPath, 'repomix-output.txt');
  }

  async pack(): Promise<PackResult> {
    try {
      // Check if repomix is installed
      await this.checkRepomixInstallation();

      // Run repomix
      const command = `repomix --output "${this.outputFile}"`;
      await execAsync(command, { cwd: this.projectPath });

      // Read the packed content
      const content = await fs.readFile(this.outputFile, 'utf-8');

      // Generate summary data
      const summary = this.generateSummary(content);

      // Clean up the output file
      await fs.remove(this.outputFile);

      return { content, summary };
    } catch (error: any) {
      if (error.message.includes('repomix: command not found')) {
        await this.installRepomix();
        return this.pack(); // Retry after installation
      }

      throw new Error(`Failed to pack repository: ${error.message}`);
    }
  }

  async checkRepomixInstallation(): Promise<void> {
    try {
      await execAsync('which repomix');
    } catch {
      throw new Error('repomix: command not found');
    }
  }

  async installRepomix(): Promise<void> {
    try {
      await execAsync('npm install -g repomix');
    } catch (error: any) {
      throw new Error(`Failed to install repomix: ${error.message}`);
    }
  }

  generateSummary(content: string): PackSummary {
    // Extract basic statistics from content
    const lines = content.split('\n');
    const totalLines = lines.length;

    // Count files (look for new repomix format: <file path="...">)
    const fileMatches = content.match(/<file path="([^"]+)"/g) || [];
    const fileCount = fileMatches.length;

    // Estimate token count (rough approximation: 1 token ≈ 4 characters)
    const estimatedTokens = Math.round(content.length / 4);

    // Get file size in KB
    const sizeKB = Math.round(content.length / 1024);

    // Get sample files for display (extract just the path from the match)
    const sampleFiles = fileMatches.slice(0, 3).map(match => {
      const pathMatch = match.match(/<file path="([^"]+)"/);
      return pathMatch ? pathMatch[1] : 'unknown';
    });

    return {
      fileCount,
      totalLines,
      sizeKB,
      estimatedTokens,
      sampleFiles,
      hasMoreFiles: fileMatches.length > 3,
      remainingCount: Math.max(0, fileMatches.length - 3),
    };
  }
}
