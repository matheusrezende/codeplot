import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';

export class SessionManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.sessionsDir = path.join(projectPath, '.codeplot', 'sessions');
  }

  /**
   * Ensures the sessions directory exists
   */
  async ensureSessionsDir() {
    try {
      await fs.ensureDir(this.sessionsDir);
    } catch (error) {
      throw new Error(`Failed to create sessions directory: ${error.message}`);
    }
  }

  /**
   * Lists all existing session files
   * @returns {Array} Array of session file objects with name and path
   */
  async listSessions() {
    try {
      await this.ensureSessionsDir();
      const files = await fs.readdir(this.sessionsDir);
      const sessionFiles = files.filter(file => file.endsWith('.json'));

      return sessionFiles.map(file => ({
        name: path.basename(file, '.json'),
        path: path.join(this.sessionsDir, file),
        displayName: this.formatSessionDisplayName(file),
      }));
    } catch (error) {
      throw new Error(`Failed to list sessions: ${error.message}`);
    }
  }

  /**
   * Loads a session from file
   * @param {string} sessionPath - Path to the session file
   * @returns {Object} Session data with featureData and chatHistory
   */
  async loadSession(sessionPath) {
    try {
      if (!(await fs.pathExists(sessionPath))) {
        throw new Error(`Session file not found: ${sessionPath}`);
      }

      const sessionData = await fs.readJson(sessionPath);

      // Validate session structure
      if (!sessionData.featureData || !sessionData.chatHistory) {
        throw new Error('Invalid session file format. Missing featureData or chatHistory.');
      }

      return sessionData;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in session file: ${sessionPath}`);
      }
      throw error;
    }
  }

  /**
   * Saves session data to file
   * @param {string} sessionName - Name of the session (without .json extension)
   * @param {Object} featureData - Feature-specific data
   * @param {Array} chatHistory - Chat conversation history
   * @param {Object} extendedData - Extended data including state machine info and codebase
   */
  async saveSession(sessionName, featureData, chatHistory, extendedData = {}) {
    try {
      await this.ensureSessionsDir();

      const sessionPath = path.join(this.sessionsDir, `${sessionName}.json`);
      const sessionData = {
        featureData,
        chatHistory,
        lastUpdated: new Date().toISOString(),
        ...extendedData, // Include machine state, codebase content, etc.
      };

      await fs.writeJson(sessionPath, sessionData, { spaces: 2 });
      return sessionPath;
    } catch (error) {
      throw new Error(`Failed to save session: ${error.message}`);
    }
  }

  /**
   * Prompts user to select a session or start a new one
   * @returns {Object} Object with type ('new' or 'resume') and sessionData if resuming
   */
  async promptUserForSession() {
    try {
      const sessions = await this.listSessions();
      const choices = [
        {
          name: '🆕 Start a new feature plan',
          value: { type: 'new' },
        },
      ];

      if (sessions.length > 0) {
        choices.push(new inquirer.Separator('--- Existing Sessions ---'));

        sessions.forEach(session => {
          choices.push({
            name: `📝 ${session.displayName}`,
            value: { type: 'resume', sessionPath: session.path, sessionName: session.name },
          });
        });
      }

      const { selection } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selection',
          message: 'What would you like to do?',
          choices,
        },
      ]);

      if (selection.type === 'resume') {
        const sessionData = await this.loadSession(selection.sessionPath);
        return {
          type: 'resume',
          sessionData,
          sessionName: selection.sessionName,
        };
      }

      return { type: 'new' };
    } catch (error) {
      throw new Error(`Failed to prompt for session: ${error.message}`);
    }
  }

  /**
   * Formats session filename for display
   * @param {string} filename - The session filename
   * @returns {string} Formatted display name
   */
  formatSessionDisplayName(filename) {
    const baseName = path.basename(filename, '.json');
    // Convert kebab-case to title case
    return baseName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generates a session name from feature description
   * @param {string} featureDescription - The feature description
   * @returns {string} Kebab-case session name
   */
  generateSessionName(featureDescription) {
    // Extract meaningful words and convert to kebab-case
    return featureDescription
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Remove duplicate hyphens
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 50); // Limit length
  }

  /**
   * Gets session choice without user interaction - for ink UI to handle
   * @returns {string} 'new' for new session, or null if no existing sessions
   */
  async getSessionChoice() {
    try {
      const sessions = await this.listSessions();

      if (sessions.length === 0) {
        return 'new';
      }

      // For now, always return 'new' - the ink UI will handle session selection later
      // This could be enhanced to show existing sessions in the ink UI
      return 'new';
    } catch (error) {
      throw new Error(`Failed to get session choice: ${error.message}`);
    }
  }

  /**
   * Deletes a session file
   * @param {string} sessionPath - Path to the session file to delete
   */
  async deleteSession(sessionPath) {
    try {
      await fs.remove(sessionPath);
    } catch (error) {
      throw new Error(`Failed to delete session: ${error.message}`);
    }
  }
}
