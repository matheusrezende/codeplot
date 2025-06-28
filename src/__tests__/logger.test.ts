import { logger } from '../utils/logger';

describe('Logger', () => {
  it('should initialize without errors', () => {
    expect(logger).toBeDefined();
  });
});
