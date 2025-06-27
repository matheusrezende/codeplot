import { RepoPackager } from '../repo-packager.js';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Create mock functions
const mockExec = jest.fn();
const mockReadFile = jest.fn();
const mockRemove = jest.fn();

// Mock the child_process and fs modules
jest.mock('child_process', () => ({
  exec: mockExec,
}));

jest.mock('fs-extra', () => ({
  readFile: mockReadFile,
  remove: mockRemove,
}));

describe('RepoPackager', () => {
  let repoPackager;
  const mockProjectPath = '/test/project';

  beforeEach(() => {
    repoPackager = new RepoPackager(mockProjectPath);
  });

  describe('constructor', () => {
    it('should set project path and output file', () => {
      expect(repoPackager.projectPath).toBe(mockProjectPath);
      expect(repoPackager.outputFile).toContain('repomix-output.txt');
    });
  });

  describe('checkRepomixInstallation', () => {
    beforeEach(() => {
      mockExec.mockReset();
    });

    it('should not throw when repomix is installed', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        callback(null, 'repomix found');
      });

      await expect(repoPackager.checkRepomixInstallation()).resolves.not.toThrow();
    });
  });
});
