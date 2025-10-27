import winston from 'winston';

// Custom format for GDPR-compliant logging
const gdprFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // Remove any potential PII from logs
    const sanitizedMeta = { ...meta };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'email', 'phone', 'ssn', 'creditCard', 'token'];
    sensitiveFields.forEach(field => {
      if (sanitizedMeta[field]) {
        sanitizedMeta[field] = '[REDACTED]';
      }
    });

    // Remove nested sensitive data
    const sanitizeObject = (obj) => {
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (sensitiveFields.includes(key.toLowerCase())) {
            obj[key] = '[REDACTED]';
          } else if (typeof obj[key] === 'object') {
            sanitizeObject(obj[key]);
          }
        }
      }
    };

    sanitizeObject(sanitizedMeta);

    return JSON.stringify({
      timestamp,
      level,
      message,
      ...sanitizedMeta
    });
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: gdprFormat,
  defaultMeta: { service: 'qic-backend' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  // Directory already exists or permission error
}

// Log levels: error, warn, info, http, verbose, debug, silly
export default logger;
