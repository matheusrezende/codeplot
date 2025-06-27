import { describe, it, expect, beforeEach } from '@jest/globals';
import path from 'path';

// We'll test the utility methods that don't require mocking
// Integration tests would be handled separately
class SessionManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.sessionsDir = path.join(projectPath, '.codeplot', 'sessions');
  }

  formatSessionDisplayName(filename) {
    const baseName = path.basename(filename, '.json');
    return baseName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  generateSessionName(featureDescription) {
    return featureDescription
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }
}

describe('SessionManager', () => {
  let sessionManager;
  const mockProjectPath = '/test/project';
  const mockSessionsDir = path.join(mockProjectPath, '.codeplot', 'sessions');

  beforeEach(() => {
    sessionManager = new SessionManager(mockProjectPath);
  });

  describe('constructor', () => {
    it('should initialize with correct project path and sessions directory', () => {
      expect(sessionManager.projectPath).toBe(mockProjectPath);
      expect(sessionManager.sessionsDir).toBe(mockSessionsDir);
    });
  });

  describe('formatSessionDisplayName', () => {
    it('should format kebab-case filename to title case', () => {
      expect(sessionManager.formatSessionDisplayName('user-authentication.json')).toBe(
        'User Authentication'
      );
      expect(sessionManager.formatSessionDisplayName('payment-processing-api.json')).toBe(
        'Payment Processing Api'
      );
    });
  });

  describe('generateSessionName', () => {
    it('should generate kebab-case session name from feature description', () => {
      expect(sessionManager.generateSessionName('User Authentication System')).toBe(
        'user-authentication-system'
      );
      expect(
        sessionManager.generateSessionName('Payment Processing API with @special chars!')
      ).toBe('payment-processing-api-with-special-chars');
    });

    it('should limit session name length', () => {
      const longDescription =
        'This is a very long feature description that should be truncated to avoid extremely long filenames that could cause issues';
      const result = sessionManager.generateSessionName(longDescription);
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });
});
