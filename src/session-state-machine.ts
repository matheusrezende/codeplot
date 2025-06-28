import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { ChatSession } from './chat-session.js';
import { RepoPackager } from './repo-packager.js';
import { SessionManager } from './session-manager.js';

interface PackSummary {
  fileCount: number;
  totalLines: number;
  sizeKB: number;
  estimatedTokens: number;
  sampleFiles: string[];
  hasMoreFiles: boolean;
  remainingCount: number;
}

interface SessionData {
  featureData?: any;
  chatHistory?: any[];
  machineState?: string;
  codebaseContent?: any;
  codebaseHash?: string;
  lastCodebaseUpdate?: string;
  repomixSummary?: PackSummary;
}

interface SessionChoice {
  type: string;
  sessionData: SessionData;
  sessionName: string;
}

interface StateInfo {
  state: string;
  hasCodebase: boolean;
  hasChatHistory: boolean;
  isCompleted: boolean;
  sessionName: string | null;
}

interface StateMachinePackResult {
  fromCache: boolean;
  summary?: PackSummary;
}

/**
 * State machine for managing session lifecycle and codebase state
 * States: FRESH -> CODEBASE_PACKED -> CHAT_INITIALIZED -> PLANNING -> COMPLETED
 */
export class SessionStateMachine {
  public sessionManager: SessionManager;
  public repoPackager: RepoPackager;
  public chatSession: ChatSession;
  public states: { [key: string]: string };
  public codebaseContent: any;
  public repomixSummary: PackSummary | null;
  private currentState: string;
  private sessionData: SessionData | null;
  private sessionName: string | null;
  private codebaseHash: string | null;

  constructor(
    sessionManager: SessionManager,
    repoPackager: RepoPackager,
    chatSession: ChatSession
  ) {
    this.sessionManager = sessionManager;
    this.repoPackager = repoPackager;
    this.chatSession = chatSession;

    // Define possible states
    this.states = {
      FRESH: 'fresh',
      CODEBASE_PACKED: 'codebase_packed',
      CHAT_INITIALIZED: 'chat_initialized',
      PLANNING: 'planning',
      COMPLETED: 'completed',
    };

    this.currentState = this.states.FRESH;
    this.sessionData = null;
    this.sessionName = null;
    this.codebaseContent = null;
    this.codebaseHash = null;
    this.repomixSummary = null;
  }

  /**
   * Load session and determine current state
   */
  async loadSession(
    sessionPath: string | null = null,
    sessionChoice: SessionChoice | null = null
  ): Promise<void> {
    if (sessionPath) {
      // Direct session path provided
      this.sessionData = await this.sessionManager.loadSession(sessionPath);
      this.sessionName = path.basename(sessionPath, '.json');
    } else if (sessionChoice?.type === 'resume') {
      // Interactive session selection
      this.sessionData = sessionChoice.sessionData;
      this.sessionName = sessionChoice.sessionName;
    }

    if (this.sessionData) {
      // Determine current state based on session data
      this.currentState = this.determineStateFromSession(this.sessionData);
    }
  }

  /**
   * Determine the current state based on session data
   */
  determineStateFromSession(sessionData: SessionData): string {
    if (sessionData.featureData?.adr_content) {
      return this.states.COMPLETED;
    }

    if (sessionData.chatHistory && sessionData.chatHistory.length > 0) {
      return this.states.PLANNING;
    }

    if (sessionData.codebaseContent) {
      return this.states.CODEBASE_PACKED;
    }

    return this.states.FRESH;
  }

  /**
   * Execute state transitions to reach target state
   */
  async transitionTo(targetState: string): Promise<void> {
    const stateOrder = [
      this.states.FRESH,
      this.states.CODEBASE_PACKED,
      this.states.CHAT_INITIALIZED,
      this.states.PLANNING,
      this.states.COMPLETED,
    ];

    const currentIndex = stateOrder.indexOf(this.currentState);
    const targetIndex = stateOrder.indexOf(targetState);

    if (targetIndex <= currentIndex) {
      return;
    }

    // Execute transitions sequentially
    for (let i = currentIndex; i < targetIndex; i++) {
      await this.executeTransition(stateOrder[i], stateOrder[i + 1]);
    }
  }

  /**
   * Execute a single state transition
   */
  async executeTransition(fromState: string, toState: string): Promise<void> {
    switch (toState) {
      case this.states.CODEBASE_PACKED:
        await this.packCodebase();
        break;
      case this.states.CHAT_INITIALIZED:
        await this.initializeChat();
        break;
      case this.states.PLANNING:
        // Planning state is handled externally by conductFeaturePlanning
        break;
      case this.states.COMPLETED:
        // Completion state is handled externally
        break;
    }

    this.currentState = toState;
  }

  /**
   * Pack codebase with smart caching
   */
  async packCodebase(): Promise<StateMachinePackResult> {
    // Check if we have cached codebase content and if it's still valid
    if (this.sessionData?.codebaseContent && this.sessionData?.codebaseHash) {
      const currentHash = await this.calculateCodebaseHash();

      if (currentHash === this.sessionData.codebaseHash) {
        this.codebaseContent = this.sessionData.codebaseContent;
        this.codebaseHash = this.sessionData.codebaseHash;
        this.repomixSummary = this.sessionData.repomixSummary || null;
        return { fromCache: true };
      }
    }

    // Pack the repository
    const packResult = await this.repoPackager.pack();
    this.codebaseContent = packResult.content;
    this.repomixSummary = packResult.summary;
    this.codebaseHash = await this.calculateCodebaseHash();

    // Update session data with codebase content
    if (this.sessionData) {
      this.sessionData.codebaseContent = this.codebaseContent;
      this.sessionData.codebaseHash = this.codebaseHash;
      this.sessionData.repomixSummary = this.repomixSummary || undefined;
      this.sessionData.lastCodebaseUpdate = new Date().toISOString();
    }

    return { fromCache: false, summary: this.repomixSummary || undefined };
  }

  /**
   * Initialize chat session
   */
  async initializeChat(): Promise<void> {
    await this.chatSession.initialize(this.codebaseContent, this.sessionData);
  }

  /**
   * Calculate hash of the current codebase to detect changes
   */
  async calculateCodebaseHash(): Promise<string> {
    try {
      // Get list of tracked files with their modification times
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Use git to get list of tracked files and their last commit hashes
      // This gives us a good representation of the "logical" state of the codebase
      const { stdout } = await execAsync('git ls-files -s', {
        cwd: this.repoPackager.projectPath,
      });

      // Create hash from git index state
      return crypto.createHash('sha256').update(stdout).digest('hex').substring(0, 16);
    } catch {
      // Fallback: hash based on directory structure and file sizes
      const hashInput = await this.getFileSystemState();
      return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
    }
  }

  /**
   * Get filesystem state for hashing (fallback when git is not available)
   */
  async getFileSystemState(): Promise<string> {
    const patterns = [
      '**/*.js',
      '**/*.ts',
      '**/*.jsx',
      '**/*.tsx',
      '**/*.py',
      '**/*.rb',
      '**/*.php',
      '**/*.go',
      '**/*.java',
      '**/*.c',
      '**/*.cpp',
      '**/*.h',
      '**/*.md',
      '**/*.json',
      '**/*.yml',
      '**/*.yaml',
    ];

    let stateString = '';

    for (const pattern of patterns) {
      try {
        const glob = await import('glob');
        const files = await glob.glob(pattern, {
          cwd: this.repoPackager.projectPath,
          ignore: ['node_modules/**', '.git/**', '**/*.test.*', '**/test/**'],
        });

        for (const file of files.slice(0, 100)) {
          // Limit to first 100 files for performance
          const fullPath = path.join(this.repoPackager.projectPath, file);
          const stat = await fs.stat(fullPath);
          stateString += `${file}:${stat.size}:${stat.mtime.getTime()}\n`;
        }
      } catch {
        // Skip pattern if glob fails
        continue;
      }
    }

    return stateString;
  }

  /**
   * Save current session state
   */
  async saveState(): Promise<void> {
    if (!this.sessionName || !this.sessionData) {
      return;
    }

    // Update session data with current state
    this.sessionData.machineState = this.currentState;
    this.sessionData.codebaseContent = this.codebaseContent;
    this.sessionData.codebaseHash = this.codebaseHash || undefined;

    try {
      await this.sessionManager.saveSession(
        this.sessionName,
        this.sessionData.featureData,
        this.sessionData.chatHistory || [],
        {
          machineState: this.currentState,
          codebaseContent: this.codebaseContent,
          codebaseHash: this.codebaseHash || undefined,
          lastCodebaseUpdate: this.sessionData.lastCodebaseUpdate,
        }
      );
    } catch {
      // Failed to save session state - silently ignore for now
    }
  }

  /**
   * Get current state information
   */
  getStateInfo(): StateInfo {
    return {
      state: this.currentState,
      hasCodebase: !!this.codebaseContent,
      hasChatHistory: !!this.sessionData?.chatHistory?.length,
      isCompleted: this.currentState === this.states.COMPLETED,
      sessionName: this.sessionName,
    };
  }
}
