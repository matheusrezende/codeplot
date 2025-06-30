import { singleton } from 'tsyringe';
import winston from 'winston';
import 'winston-daily-rotate-file';
import { ILoggerService } from './logger.interface';

@singleton()
export class LoggerService implements ILoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    const isDebug = process.argv.includes('--debug');

    const consoleTransport = isDebug
      ? new winston.transports.Console({
          level: 'debug',
          format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        })
      : new winston.transports.Console({
          level: 'warn',
          format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        });

    const fileTransport = new winston.transports.DailyRotateFile({
      level: 'debug',
      filename: 'logs/codeplot-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    });

    this.logger = winston.createLogger({
      transports: [consoleTransport, fileTransport],
    });
  }

  public info(message: string, ...meta: unknown[]): void {
    this.logger.info(message, meta);
  }

  public warn(message: string, ...meta: unknown[]): void {
    this.logger.warn(message, meta);
  }

  public error(message: string, ...meta: unknown[]): void {
    this.logger.error(message, meta);
  }

  public debug(message: string, ...meta: unknown[]): void {
    this.logger.debug(message, meta);
  }
}
