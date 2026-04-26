import winston from 'winston';
import fs from 'fs';

const transports: winston.transport[] = [
  new winston.transports.Console({
    format:
      process.env.NODE_ENV === 'production'
        ? winston.format.json()
        : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  }),
];

if (process.env.LOG_TO_FILES === 'true') {
  try {
    fs.mkdirSync('logs', { recursive: true });
    transports.push(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
    transports.push(new winston.transports.File({ filename: 'logs/combined.log' }));
  } catch {
    // If the filesystem isn't writable (common in containers), fall back to console only.
  }
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports,
});
