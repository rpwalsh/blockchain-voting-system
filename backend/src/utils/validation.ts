/**
 * INPUT VALIDATION & SANITIZATION
 * ===============================
 * Security Level: Hostile input assumption
 * 
 * THREAT MODEL:
 * - SQL Injection (mitigated by Prisma ORM + validation)
 * - XSS (Cross-Site Scripting) via stored input
 * - Command Injection
 * - Path Traversal
 * - LDAP Injection
 * - XML/XXE attacks
 * - Prototype Pollution
 * - ReDoS (Regular Expression Denial of Service)
 * 
 * DEFENSE STRATEGY:
 * - Whitelist validation (allow known good, reject everything else)
 * - Length limits on all inputs
 * - Type checking with Joi schemas
 * - HTML/Script stripping
 * - Unicode normalization
 * - Rate limiting per input pattern
 */

import Joi from 'joi';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';
import { createSecurityEvent, SecuritySeverity } from './audit';

// SECURITY: Maximum input lengths to prevent DoS
const MAX_LENGTHS = {
  UUID: 36,
  NAME: 200,
  DESCRIPTION: 2000,
  PLATFORM: 5000,
  USERNAME: 50,
  PASSWORD: 128,
  TOKEN: 100,
  URL: 2048,
  EMAIL: 254,
  PHONE: 20,
};

// SECURITY: Regex patterns (non-backtracking to prevent ReDoS)
const PATTERNS = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  USERNAME: /^[a-zA-Z0-9_]{3,50}$/,
  ALPHANUMERIC: /^[a-zA-Z0-9 ]+$/,
  SAFE_NAME: /^[a-zA-Z0-9 '-]+$/,
  BASE64: /^[A-Za-z0-9+/=]+$/,
  HEX: /^[0-9a-fA-F]+$/,
};

/**
 * Sanitize string input
 * SECURITY: Remove dangerous characters and limit length
 * 
 * @param input - Input string
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength: number = MAX_LENGTHS.DESCRIPTION): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  
  // Trim whitespace
  let sanitized = input.trim();
  
  // Normalize unicode to prevent homograph attacks
  sanitized = sanitized.normalize('NFC');
  
  // Remove null bytes (can cause security issues in C-based systems)
  sanitized = sanitized.replace(/\0/g, '');
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // Escape HTML to prevent XSS
  sanitized = validator.escape(sanitized);
  
  return sanitized;
}

/**
 * Sanitize HTML content (for platforms/descriptions)
 * SECURITY: Whitelist-based HTML sanitization
 * 
 * @param input - HTML input
 * @returns Sanitized HTML
 */
export function sanitizeHTML(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
    allowedAttributes: {
      'a': ['href'],
    },
    disallowedTagsMode: 'discard',
  });
}

/**
 * Validate UUID
 * SECURITY: Prevents injection via UUID fields
 * 
 * @param uuid - UUID to validate
 * @returns True if valid
 */
export function isValidUUID(uuid: string): boolean {
  return validator.isUUID(uuid, 4);
}

/**
 * Validate election data
 */
export const electionSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(MAX_LENGTHS.NAME)
    .pattern(PATTERNS.SAFE_NAME)
    .required()
    .messages({
      'string.pattern.base': 'Name contains invalid characters',
      'string.min': 'Name must be at least 3 characters',
      'string.max': `Name must not exceed ${MAX_LENGTHS.NAME} characters`,
    }),
  
  description: Joi.string()
    .max(MAX_LENGTHS.DESCRIPTION)
    .optional()
    .allow('', null),
  
  startDate: Joi.date()
    .iso()
    .min('now')
    .required()
    .messages({
      'date.min': 'Start date must be in the future',
    }),
  
  endDate: Joi.date()
    .iso()
    .greater(Joi.ref('startDate'))
    .required()
    .messages({
      'date.greater': 'End date must be after start date',
    }),
  
  candidates: Joi.array()
    .items(
      Joi.object({
        name: Joi.string()
          .min(2)
          .max(MAX_LENGTHS.NAME)
          .pattern(PATTERNS.SAFE_NAME)
          .required(),
        party: Joi.string()
          .max(MAX_LENGTHS.NAME)
          .pattern(PATTERNS.SAFE_NAME)
          .optional()
          .allow('', null),
        platform: Joi.string()
          .max(MAX_LENGTHS.PLATFORM)
          .optional()
          .allow('', null),
      })
    )
    .min(2)
    .max(100)
    .required()
    .messages({
      'array.min': 'Must have at least 2 candidates',
      'array.max': 'Cannot have more than 100 candidates',
    }),
});

/**
 * Validate voter registration
 */
export const voterRegistrationSchema = Joi.object({
  electionId: Joi.string()
    .uuid()
    .required(),
  
  voterId: Joi.string()
    .min(5)
    .max(100)
    .required()
    .messages({
      'string.min': 'Voter ID must be at least 5 characters',
    }),
  
  voterData: Joi.object()
    .pattern(
      Joi.string(),
      Joi.alternatives().try(
        Joi.string().max(500),
        Joi.number(),
        Joi.boolean()
      )
    )
    .optional(),
});

/**
 * Validate vote casting
 */
export const voteSchema = Joi.object({
  electionId: Joi.string()
    .uuid()
    .required(),
  
  votingToken: Joi.string()
    .min(20)
    .max(MAX_LENGTHS.TOKEN)
    .pattern(PATTERNS.BASE64)
    .required()
    .messages({
      'string.pattern.base': 'Invalid voting token format',
    }),
  
  candidateId: Joi.string()
    .uuid()
    .required(),
});

/**
 * Validate admin login
 */
export const adminLoginSchema = Joi.object({
  username: Joi.string()
    .min(3)
    .max(MAX_LENGTHS.USERNAME)
    .pattern(PATTERNS.USERNAME)
    .required()
    .messages({
      'string.pattern.base': 'Username must be alphanumeric with underscores only',
    }),
  
  password: Joi.string()
    .min(12)
    .max(MAX_LENGTHS.PASSWORD)
    .required()
    .messages({
      'string.min': 'Password must be at least 12 characters',
    }),
  
  mfaCode: Joi.string()
    .length(6)
    .pattern(/^[0-9]{6}$/)
    .optional(),
});

/**
 * Validate election status change
 */
export const statusChangeSchema = Joi.object({
  status: Joi.string()
    .valid('DRAFT', 'REGISTRATION', 'VOTING', 'TALLYING', 'COMPLETED', 'CANCELLED')
    .required(),
});

/**
 * Validate tally request
 */
export const tallySchema = Joi.object({
  privateKey: Joi.string()
    .pattern(PATTERNS.BASE64)
    .required()
    .messages({
      'string.pattern.base': 'Invalid private key format',
    }),
});

/**
 * Detect suspicious patterns
 * SECURITY: Identify potential attack patterns
 * 
 * @param input - Input to analyze
 * @param context - Context information
 * @returns True if suspicious
 */
export async function detectSuspiciousInput(
  input: any,
  context: { ip?: string; userId?: string; action?: string }
): Promise<boolean> {
  const inputStr = JSON.stringify(input);
  
  // SQL Injection patterns
  const sqlPatterns = [
    /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b)/i,
    /--/,
    /\/\*/,
    /\*\//,
    /;/,
  ];
  
  // XSS patterns
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // event handlers
    /<iframe/i,
    /eval\(/i,
  ];
  
  // Command injection patterns
  const cmdPatterns = [
    /\$\(.*\)/,
    /`[^`]*`/,
    /\|\|/,
    /&&/,
    /;\s*\w+/,
  ];
  
  // Path traversal patterns
  const pathPatterns = [
    /\.\.\//,
    /\.\.\\\\/, // Escaped backslashes for Windows
    /%2e%2e/i,
  ];
  
  let suspicious = false;
  let detectedPattern = '';
  
  // Check all patterns
  for (const pattern of [...sqlPatterns, ...xssPatterns, ...cmdPatterns, ...pathPatterns]) {
    if (pattern.test(inputStr)) {
      suspicious = true;
      detectedPattern = pattern.toString();
      break;
    }
  }
  
  if (suspicious) {
    // Log security event
    await createSecurityEvent({
      severity: SecuritySeverity.HIGH,
      eventType: 'SUSPICIOUS_INPUT_DETECTED',
      details: {
        pattern: detectedPattern,
        action: context.action,
        userId: context.userId,
        ip: context.ip,
        inputLength: inputStr.length,
      },
    });
  }
  
  return suspicious;
}

/**
 * Rate limit check for specific pattern
 * SECURITY: Detect brute force and automated attacks
 * 
 * @param key - Unique key (IP, user ID, etc.)
 * @param maxAttempts - Maximum attempts allowed
 * @param windowMs - Time window in milliseconds
 * @returns True if rate limit exceeded
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxAttempts: number = 10,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetAt) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return false;
  }
  
  if (record.count >= maxAttempts) {
    return true; // Rate limit exceeded
  }
  
  record.count++;
  return false;
}

/**
 * Clean up rate limit store periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

export default {
  sanitizeString,
  sanitizeHTML,
  isValidUUID,
  detectSuspiciousInput,
  checkRateLimit,
  electionSchema,
  voterRegistrationSchema,
  voteSchema,
  adminLoginSchema,
  statusChangeSchema,
  tallySchema,
};
