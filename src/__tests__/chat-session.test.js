import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ChatSession } from '../chat-session.js';

describe('ChatSession', () => {
  let mockModel;
  let chatSession;

  beforeEach(() => {
    mockModel = {
      startChat: jest.fn().mockReturnValue({
        sendMessageStream: jest.fn(),
      }),
    };
    chatSession = new ChatSession(mockModel);
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(chatSession.streamingEnabled).toBe(true);
      expect(chatSession.typingSpeed).toBe('normal');
    });

    it('should accept custom options', () => {
      const customSession = new ChatSession(mockModel, {
        streaming: false,
        typingSpeed: 'fast',
      });
      expect(customSession.streamingEnabled).toBe(false);
      expect(customSession.typingSpeed).toBe('fast');
    });
  });

  describe('extractFeatureName', () => {
    it('should extract and format feature name', () => {
      const result = chatSession.extractFeatureName('User Authentication System with OAuth');
      expect(result).toBe('user-authentication-system-with-oauth');
    });

    it('should handle special characters', () => {
      const result = chatSession.extractFeatureName('API Rate-Limiting & Throttling!');
      expect(result).toBe('api-rate-limiting-throttling');
    });
  });

  describe('generateADRFilename', () => {
    it('should generate proper ADR filename', () => {
      const result = chatSession.generateADRFilename('user-auth');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-user-auth\.md$/);
    });
  });

  describe('extractImplementationPlan', () => {
    it('should extract implementation plan from ADR content', () => {
      const adrContent = `
# ADR Title

## Context
Some context

## Implementation Plan
1. Create user model
2. Add authentication middleware
3. Update routes

## Consequences
Some consequences
      `;

      const result = chatSession.extractImplementationPlan(adrContent);
      expect(result).toContain('1. Create user model');
      expect(result).toContain('2. Add authentication middleware');
    });

    it('should return empty string if no implementation plan found', () => {
      const adrContent = 'No implementation plan here';
      const result = chatSession.extractImplementationPlan(adrContent);
      expect(result).toBe('');
    });
  });

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      await chatSession.sleep(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });
  });
});
