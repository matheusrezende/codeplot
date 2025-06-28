# Debug Logging

This document explains how to use the debug logging features in Codeplot.

## Quick Start

To run the application with debug logging enabled:

```bash
# Using npm scripts
npm run start:debug

# Or directly with the CLI
codeplot plan --debug

# With custom log level
codeplot plan --debug --log-level trace
```

## Debug Features

### 1. Debug Flag

- **`--debug`**: Enables debug mode with:
  - Verbose console output with emojis
  - Stack traces when errors occur (application will crash)
  - Detailed function call logging
  - API call timing and payload logging
  - State change tracking

### 2. Log Levels

- **`--log-level <level>`**: Set the minimum log level to capture
  - `error`: Only errors
  - `warn`: Warnings and errors
  - `info`: Info, warnings, and errors (default)
  - `debug`: Debug info and above
  - `trace`: All logging (most verbose)

### 3. Log File Location

Debug logs are always written to: `./debug.log` in your current working directory

### 4. Log Rotation

- Logs automatically rotate when they exceed 10MB
- Keeps up to 5 rotated log files (debug.log.1, debug.log.2, etc.)
- Oldest logs are automatically deleted

## Environment Variables

You can also set these via environment variables:

```bash
export DEBUG=true
export LOG_LEVEL=debug
codeplot plan
```

## Log Format

Each log entry includes:

- Timestamp (ISO format)
- Process ID
- Log level
- Component name
- Message
- Metadata (when available)

Example:

```
[2024-06-28T12:17:42.123Z] [12345] [DEBUG] PlanningAgent: askQuestion called
Meta: {
  "featureRequestLength": 45,
  "conversationHistoryLength": 3,
  "codebaseContextLength": 15432
}
```

## Error Handling

### Normal Mode (Production)

- User-friendly error messages
- Application continues or exits gracefully
- Full error details saved to debug log
- Shows path to debug log file

### Debug Mode (Development)

- Full stack traces printed to console
- Application crashes immediately on errors
- All debug information visible in real-time
- Easier to identify root causes

## Debugging Common Issues

### Template Parsing Errors

When you see "Single '}' in template" errors:

1. Run with debug mode:

   ```bash
   codeplot plan --debug --log-level trace
   ```

2. Look for these log entries:
   - `PlanningAgent: askQuestion called`
   - `PlanningAgent: Invoking LLM chain`
   - `PlanningAgent: LLM response received`
   - `PlanningAgent: Parsing response`

3. Check the debug.log file for the full LLM response that caused the parsing error

### Session Management Issues

Look for these debug entries:

- `App: Loading specific session`
- `App: Getting session choice`
- `App: Creating state machine`

### API Call Issues

Debug logging includes:

- Request payloads (API keys are redacted)
- Response timing
- Response size
- LangChain chain invocation details

## Log Cleanup

To clear old logs:

```bash
rm debug.log*
```

Or the logger provides a programmatic way to clear logs (for testing):

```javascript
import { logger } from './src/utils/logger.js';
logger.clearLogs();
```

## Performance Impact

- **File logging**: Minimal impact (async writes)
- **Console logging**: Only enabled in debug mode
- **Log rotation**: Happens only when needed
- **Memory usage**: Logs are written incrementally, not stored in memory

## Best Practices

1. **Development**: Always use `--debug` for immediate feedback
2. **Production**: Use default settings, check debug.log when issues occur
3. **CI/CD**: Use `--log-level error` to reduce noise
4. **Debugging**: Use `--log-level trace` for maximum detail
5. **Log Analysis**: Use tools like `grep`, `jq`, or log viewers to analyze debug.log

## Security Notes

- API keys are automatically redacted in logs
- File paths and sensitive data are not logged
- Debug logs may contain detailed codebase information
- In production, consider log file permissions and rotation
