import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

interface FeatureData {
  adr_content: string;
  adrFilename: string;
  adr_title?: string;
  name?: string;
}

export class ADRGenerator {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async generate(featureData: FeatureData): Promise<string> {
    try {
      // Ensure output directory exists
      await fs.ensureDir(this.outputDir);

      // Check if adr-tools is installed
      const hasADRTools = await this.checkADRToolsInstallation();

      if (hasADRTools) {
        return await this.generateWithADRTools(featureData);
      } else {
        return await this.generateManually(featureData);
      }
    } catch (error: any) {
      throw new Error(`Failed to generate ADR: ${error.message}`);
    }
  }

  async generateWithADRTools(featureData: FeatureData): Promise<string> {
    try {
      // Initialize ADR directory if it doesn't exist
      await this.initializeADRDirectory();

      // Get the title for adr-tools (remove special characters for command line safety)
      const adrTitle = featureData.adr_title || featureData.name;
      const safeTitleForCommand = (adrTitle || '').replace(/[^a-zA-Z0-9\s-]/g, '').trim();

      // Use adr-tools to create a new ADR
      const docDir = path.join(this.outputDir, '..');
      const adrCommand = `adr new "${safeTitleForCommand}"`;

      // Set EDITOR to prevent adr-tools from opening interactive editor
      const env = { ...process.env, EDITOR: 'true' };
      const { stdout } = await execAsync(adrCommand, { cwd: docDir, env });

      // Extract the created filename from adr-tools output
      const filenameMatch = stdout.match(/(\d+-[^\s]+\.md)/);
      let adrPath: string;

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

      return adrPath;
    } catch {
      // Fallback to manual generation if adr-tools fails
      return await this.generateManually(featureData);
    }
  }

  async generateManually(featureData: FeatureData): Promise<string> {
    const adrPath = path.join(this.outputDir, featureData.adrFilename);
    await fs.writeFile(adrPath, featureData.adr_content, 'utf-8');
    return adrPath;
  }

  async checkADRToolsInstallation(): Promise<boolean> {
    try {
      await execAsync('which adr');
      return true;
    } catch {
      return false;
    }
  }

  async initializeADRDirectory(): Promise<void> {
    try {
      // Check if ADR directory is already initialized by looking for existing ADR files
      const adrFiles = await fs.readdir(this.outputDir);
      const existingADRs = adrFiles.filter(
        file => file.match(/^\d{4}-.*\.md$/) && file !== '0001-record-architecture-decisions.md'
      );

      // Also check for the default initialization file
      const hasInitFile = adrFiles.some(file => file === '0001-record-architecture-decisions.md');

      // If we have existing ADRs or the init file, don't run adr init again
      if (existingADRs.length > 0 || hasInitFile) {
        return; // Already initialized
      }

      // Directory is empty or doesn't exist, safe to initialize
      const docDir = path.join(this.outputDir, '..');
      await execAsync('adr init', { cwd: docDir });
    } catch {
      // Directory might not exist yet, or adr-tools not available
      // We'll handle this gracefully - ensure directory exists for manual generation
      await fs.ensureDir(this.outputDir);
    }
  }
}
