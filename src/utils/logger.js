import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
  constructor() {
    this.isDebugMode = process.env.DEBUG === 'true' || process.argv.includes('--debug');
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logFile = path.join(process.cwd(), 'debug.log');
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = 5;

    // Create logs directory if it doesn't exist
    const logDir = path.dirname(this.logFile);
    fs.ensureDirSync(logDir);

    // Rotate logs if current file is too large
    this.rotateLogs();

    // Initialize log file with session start
    this.info('='.repeat(80));
    this.info(`Logger initialized - Debug Mode: ${this.isDebugMode}`);
    this.info(`Log Level: ${this.logLevel}`);
    this.info(`Process: ${process.argv.join(' ')}`);
    this.info(`Working Directory: ${process.cwd()}`);
    this.info(`Timestamp: ${new Date().toISOString()}`);
    this.info('='.repeat(80));
  }

  rotateLogs() {
    try {
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxLogSize) {
          // Rotate existing logs
          for (let i = this.maxLogFiles - 1; i > 0; i--) {
            const currentLog = `${this.logFile}.${i}`;
            const nextLog = `${this.logFile}.${i + 1}`;

            if (fs.existsSync(currentLog)) {
              if (i === this.maxLogFiles - 1) {
                fs.removeSync(currentLog);
              } else {
                fs.moveSync(currentLog, nextLog);
              }
            }
          }

          // Move current log to .1
          fs.moveSync(this.logFile, `${this.logFile}.1`);
        }
      }
    } catch (error) {
      // If rotation fails, continue anyway
      console.error('Log rotation failed:', error.message);
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;

    let formattedMessage = `[${timestamp}] [${pid}] [${level.toUpperCase()}] ${message}`;

    if (Object.keys(meta).length > 0) {
      formattedMessage += `\nMeta: ${JSON.stringify(meta, null, 2)}`;
    }

    return formattedMessage;
  }

  writeToFile(level, message, meta = {}) {
    try {
      const formattedMessage = this.formatMessage(level, message, meta);
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    } catch (error) {
      // Fallback to console if file write fails
      console.error('Failed to write to log file:', error.message);
      console.log(`[${level.toUpperCase()}]`, message, meta);
    }
  }

  shouldLog(level) {
    const levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4,
    };

    return levels[level] <= levels[this.logLevel];
  }

  error(message, meta = {}) {
    if (this.shouldLog('error')) {
      this.writeToFile('error', message, meta);

      if (this.isDebugMode) {
        console.error('❌ [ERROR]', message);
        if (Object.keys(meta).length > 0) {
          console.error('Meta:', meta);
        }
      }
    }
  }

  warn(message, meta = {}) {
    if (this.shouldLog('warn')) {
      this.writeToFile('warn', message, meta);

      if (this.isDebugMode) {
        console.warn('⚠️  [WARN]', message);
        if (Object.keys(meta).length > 0) {
          console.warn('Meta:', meta);
        }
      }
    }
  }

  info(message, meta = {}) {
    if (this.shouldLog('info')) {
      this.writeToFile('info', message, meta);

      if (this.isDebugMode) {
        console.log('ℹ️  [INFO]', message);
        if (Object.keys(meta).length > 0) {
          console.log('Meta:', meta);
        }
      }
    }
  }

  debug(message, meta = {}) {
    if (this.shouldLog('debug')) {
      this.writeToFile('debug', message, meta);

      if (this.isDebugMode) {
        console.log('🐛 [DEBUG]', message);
        if (Object.keys(meta).length > 0) {
          console.log('Meta:', meta);
        }
      }
    }
  }

  trace(message, meta = {}) {
    if (this.shouldLog('trace')) {
      this.writeToFile('trace', message, meta);

      if (this.isDebugMode) {
        console.log('🔍 [TRACE]', message);
        if (Object.keys(meta).length > 0) {
          console.log('Meta:', meta);
        }
      }
    }
  }

  // Special method for logging errors with stack traces
  errorWithStack(error, message = 'Unhandled error', meta = {}) {
    const errorMeta = {
      ...meta,
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error.cause && { cause: error.cause }),
      ...(error.code && { code: error.code }),
    };

    this.error(message, errorMeta);

    // In debug mode, also throw the error to get a proper stack trace
    if (this.isDebugMode) {
      console.error('\n' + '='.repeat(80));
      console.error('STACK TRACE FOR DEBUGGING:');
      console.error('='.repeat(80));
      throw error;
    }
  }

  // Method to log function entry/exit for debugging
  logFunctionCall(functionName, args = {}, result = null) {
    if (this.isDebugMode) {
      this.trace(`Function Call: ${functionName}`, {
        arguments: args,
        ...(result !== null && { result }),
      });
    }
  }

  // Method to log API calls
  logApiCall(method, url, requestData = {}, responseData = {}, duration = null) {
    this.debug(`API Call: ${method} ${url}`, {
      request: requestData,
      response: responseData,
      ...(duration && { duration: `${duration}ms` }),
    });
  }

  // Method to log state changes
  logStateChange(component, from, to, data = {}) {
    this.debug(`State Change: ${component}`, {
      from,
      to,
      data,
    });
  }

  // Method to get log file path for external access
  getLogFilePath() {
    return this.logFile;
  }

  // Method to clear logs
  clearLogs() {
    try {
      if (fs.existsSync(this.logFile)) {
        fs.removeSync(this.logFile);
      }

      // Remove rotated logs too
      for (let i = 1; i <= this.maxLogFiles; i++) {
        const rotatedLog = `${this.logFile}.${i}`;
        if (fs.existsSync(rotatedLog)) {
          fs.removeSync(rotatedLog);
        }
      }

      this.info('Logs cleared');
    } catch (error) {
      this.error('Failed to clear logs', { error: error.message });
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for testing
export { Logger };
