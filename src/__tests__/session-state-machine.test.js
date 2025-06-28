import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SessionStateMachine } from '../session-state-machine.js';

// Mock dependencies
const mockSessionManager = {
  loadSession: jest.fn(),
  saveSession: jest.fn(),
  generateSessionName: jest.fn(),
};

const mockRepoPackager = {
  pack: jest.fn(),
  projectPath: '/test/project',
};

const mockChatSession = {
  initialize: jest.fn(),
};

describe('SessionStateMachine', () => {
  let stateMachine;

  beforeEach(() => {
    jest.clearAllMocks();
    stateMachine = new SessionStateMachine(mockSessionManager, mockRepoPackager, mockChatSession);
  });

  describe('constructor', () => {
    it('should initialize with correct default state', () => {
      expect(stateMachine.currentState).toBe(stateMachine.states.FRESH);
      expect(stateMachine.sessionData).toBeNull();
      expect(stateMachine.sessionName).toBeNull();
      expect(stateMachine.codebaseContent).toBeNull();
    });
  });

  describe('determineStateFromSession', () => {
    it('should return COMPLETED for session with ADR content', () => {
      const sessionData = {
        featureData: { adr_content: 'some adr content' },
        chatHistory: ['message1', 'message2'],
      };

      const state = stateMachine.determineStateFromSession(sessionData);
      expect(state).toBe(stateMachine.states.COMPLETED);
    });

    it('should return PLANNING for session with chat history but no ADR', () => {
      const sessionData = {
        featureData: {},
        chatHistory: ['message1', 'message2'],
      };

      const state = stateMachine.determineStateFromSession(sessionData);
      expect(state).toBe(stateMachine.states.PLANNING);
    });

    it('should return CODEBASE_PACKED for session with codebase content', () => {
      const sessionData = {
        featureData: {},
        chatHistory: [],
        codebaseContent: 'some codebase content',
      };

      const state = stateMachine.determineStateFromSession(sessionData);
      expect(state).toBe(stateMachine.states.CODEBASE_PACKED);
    });

    it('should return FRESH for empty session', () => {
      const sessionData = {
        featureData: {},
        chatHistory: [],
      };

      const state = stateMachine.determineStateFromSession(sessionData);
      expect(state).toBe(stateMachine.states.FRESH);
    });
  });

  describe('getStateInfo', () => {
    it('should return correct state information', () => {
      stateMachine.currentState = stateMachine.states.PLANNING;
      stateMachine.codebaseContent = 'test content';
      stateMachine.sessionData = { chatHistory: ['msg1'] };
      stateMachine.sessionName = 'test-session';

      const info = stateMachine.getStateInfo();

      expect(info).toEqual({
        state: stateMachine.states.PLANNING,
        hasCodebase: true,
        hasChatHistory: true,
        isCompleted: false,
        sessionName: 'test-session',
      });
    });

    it('should return completed state correctly', () => {
      stateMachine.currentState = stateMachine.states.COMPLETED;

      const info = stateMachine.getStateInfo();
      expect(info.isCompleted).toBe(true);
    });
  });
});
