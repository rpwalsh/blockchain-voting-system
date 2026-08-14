/**
 * Audit logging: request/action log (AuditLog), security event log
 * (SecurityEvent), and the hash-chained election ledger (LedgerEntry, via
 * createLedgerEntry). See docs/protocol.md, "Stage: Audit" and
 * docs/threat-model.md for what the ledger chain actually protects against
 * and its current implementation status.
 */

import { prisma } from '../db';
import { logger } from './logger';
import crypto from '../crypto/engine';
import { domainHash, DOMAIN } from '../crypto/canonical';

export enum AuditAction {
  // Election Management
  ELECTION_CREATED = 'ELECTION_CREATED',
  ELECTION_STATUS_CHANGED = 'ELECTION_STATUS_CHANGED',
  ELECTION_TALLIED = 'ELECTION_TALLIED',
  
  // Voter Actions
  VOTER_REGISTERED = 'VOTER_REGISTERED',
  VOTE_CAST = 'VOTE_CAST',
  VOTE_VERIFIED = 'VOTE_VERIFIED',
  RECEIPT_REQUESTED = 'RECEIPT_REQUESTED',
  
  // Admin Actions
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_LOGOUT = 'ADMIN_LOGOUT',
  ADMIN_ACTION = 'ADMIN_ACTION',
  
  // Security Events
  INVALID_TOKEN = 'INVALID_TOKEN',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_PROOF = 'INVALID_PROOF',
  DOUBLE_VOTE_ATTEMPT = 'DOUBLE_VOTE_ATTEMPT',
  SUSPICIOUS_PATTERN = 'SUSPICIOUS_PATTERN',
  
  // System Events
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

export enum AuditResult {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  ERROR = 'ERROR',
  BLOCKED = 'BLOCKED',
}

export enum SecuritySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

interface AuditLogEntry {
  actor: string;
  actorType: 'ADMIN' | 'VOTER' | 'SYSTEM';
  action: AuditAction;
  resource: string;
  resourceId?: string;
  result: AuditResult;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

interface SecurityEventEntry {
  severity: SecuritySeverity;
  eventType: string;
  details: Record<string, any>;
}

/**
 * Sanitize PII from log data
 * SECURITY: Removes sensitive information before logging
 * 
 * @param data - Data to sanitize
 * @returns Sanitized data
 */
function sanitizePII(data: any): any {
  if (!data) return data;
  
  const sanitized = { ...data };
  
  // Remove sensitive fields
  const sensitiveFields = [
    'password',
    'passwordHash',
    'votingToken',
    'privateKey',
    'secretKey',
    'ssn',
    'voterId',
    'ipAddress', // Store hashed only
  ];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Create audit log entry
 * SECURITY: Immutable, append-only audit trail
 * 
 * @param entry - Audit log entry data
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    // Hash IP address for privacy
    const ipHash = entry.ipAddress 
      ? crypto.hashIPAddress(entry.ipAddress, new Date().toISOString().split('T')[0])
      : null;
    
    // Sanitize user agent
    const sanitizedUserAgent = entry.userAgent?.substring(0, 200);
    
    // Sanitize details
    const sanitizedDetails = entry.details 
      ? JSON.stringify(sanitizePII(entry.details))
      : null;
    
    // Create audit log (async, don't block request)
    await prisma.auditLog.create({
      data: {
        actor: entry.actor,
        actorType: entry.actorType,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        result: entry.result,
        ipAddress: ipHash,
        userAgent: sanitizedUserAgent,
        details: sanitizedDetails,
      },
    });
    
    // Log to Winston for immediate monitoring
    logger.info('Audit log created', {
      action: entry.action,
      actor: entry.actor,
      result: entry.result,
    });
  } catch (error) {
    // CRITICAL: Audit logging failure should not break the system
    logger.error('Failed to create audit log', { error });
  }
}

/**
 * Create security event for anomaly detection
 * SECURITY: Triggers alerts for security team
 * 
 * @param entry - Security event data
 */
export async function createSecurityEvent(entry: SecurityEventEntry): Promise<void> {
  try {
    const sanitizedDetails = JSON.stringify(sanitizePII(entry.details));
    
    await prisma.securityEvent.create({
      data: {
        severity: entry.severity,
        eventType: entry.eventType,
        details: sanitizedDetails,
      },
    });
    
    // Log critical events immediately
    if (entry.severity === SecuritySeverity.CRITICAL || entry.severity === SecuritySeverity.HIGH) {
      logger.error(`SECURITY EVENT: ${entry.eventType}`, {
        severity: entry.severity,
        details: entry.details,
      });
      
      // TODO: Send alert to security team (email, SMS, PagerDuty, etc.)
    }
  } catch (error) {
    logger.error('Failed to create security event', { error });
  }
}

/**
 * Create ledger entry for election actions
 * SECURITY: Blockchain-style chained entries for tamper detection
 * 
 * @param electionId - Election ID
 * @param entryType - Type of ledger entry
 * @param data - Entry data
 * @param signerPrivateKey - Private key for signing
 */
export async function createLedgerEntry(
  electionId: string,
  entryType: string,
  data: Record<string, any>,
  signerPrivateKey: string
): Promise<void> {
  const signerPublicKey = crypto.derivePublicKey(signerPrivateKey);
  const sanitizedData = JSON.stringify(sanitizePII(data));

  // Read-then-write against previousEntryHash races under concurrent
  // callers; the @@unique([electionId, previousEntryHash]) constraint
  // rejects a fork instead of silently persisting it, so retry against
  // the new tip on conflict rather than trusting a single read.
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const previousEntry = await prisma.ledgerEntry.findFirst({
      where: { electionId },
      orderBy: { timestamp: 'desc' },
    });

    const dataHash = domainHash(DOMAIN.ELECTION_LEDGER, {
      electionId,
      entryType,
      data: sanitizedData,
      previousEntryHash: previousEntry?.dataHash || null,
    });
    const signature = crypto.signData(dataHash, signerPrivateKey);

    try {
      await prisma.ledgerEntry.create({
        data: {
          electionId,
          entryType,
          data: sanitizedData,
          dataHash,
          signature,
          signerPublicKey,
          previousEntryHash: previousEntry?.dataHash,
        },
      });
      logger.info('Ledger entry created', { electionId, entryType });
      return;
    } catch (error: any) {
      const isChainConflict = error?.code === 'P2002';
      if (!isChainConflict || attempt === MAX_ATTEMPTS) {
        logger.error('Failed to create ledger entry', { error });
        throw error;
      }
    }
  }
}

/**
 * Middleware: Audit all requests
 * Automatically logs every API call for forensics
 */
export function auditMiddleware(req: any, res: any, next: any) {
  const startTime = Date.now();
  
  // Capture response
  const originalSend = res.json;
  res.json = function (data: any) {
    const duration = Date.now() - startTime;
    
    // Create audit log asynchronously (don't block response)
    createAuditLog({
      actor: req.user?.id || req.ip || 'anonymous',
      actorType: req.user ? 'ADMIN' : 'VOTER',
      action: `${req.method}_${req.path}` as AuditAction,
      resource: req.path,
      resourceId: req.params.id,
      result: res.statusCode < 400 ? AuditResult.SUCCESS : AuditResult.FAILURE,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        method: req.method,
        duration,
        statusCode: res.statusCode,
      },
    }).catch(err => logger.error('Audit middleware error', err));
    
    return originalSend.call(this, data);
  };
  
  next();
}

export default {
  createAuditLog,
  createSecurityEvent,
  createLedgerEntry,
  auditMiddleware,
  AuditAction,
  AuditResult,
  SecuritySeverity,
};
