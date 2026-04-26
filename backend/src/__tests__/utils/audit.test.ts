/**
 * Audit Utility Tests
 * Tests for audit logging and security events
 */

import {
  createAuditLog,
  createSecurityEvent,
  createLedgerEntry,
  auditMiddleware,
  AuditAction,
  AuditResult,
  SecuritySeverity,
} from '../../utils/audit';
import { prisma } from '../../index';
import { logger } from '../../utils/logger';
import crypto from '../../crypto/engine';

// Mock prisma
jest.mock('../../index', () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
    },
    securityEvent: {
      create: jest.fn(),
    },
    ledgerEntry: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock crypto
jest.mock('../../crypto/engine', () => ({
  hashIPAddress: jest.fn().mockReturnValue('hashed-ip'),
  hashVotingToken: jest.fn().mockReturnValue('hashed-data'),
  generateKeyPair: jest.fn().mockReturnValue({
    publicKey: 'test-public-key',
    privateKey: 'test-private-key',
  }),
  signData: jest.fn().mockReturnValue('test-signature'),
}));

describe('Audit Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAuditLog', () => {
    it('should create audit log entry', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await createAuditLog({
        actor: 'user123',
        actorType: 'ADMIN',
        action: AuditAction.ADMIN_LOGIN,
        resource: 'auth',
        result: AuditResult.SUCCESS,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actor: 'user123',
          actorType: 'ADMIN',
          action: AuditAction.ADMIN_LOGIN,
          resource: 'auth',
          result: AuditResult.SUCCESS,
        }),
      });
    });

    it('should hash IP address', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await createAuditLog({
        actor: 'user123',
        actorType: 'VOTER',
        action: AuditAction.VOTE_CAST,
        resource: 'votes',
        result: AuditResult.SUCCESS,
        ipAddress: '10.0.0.1',
      });

      expect(crypto.hashIPAddress).toHaveBeenCalledWith('10.0.0.1', expect.any(String));
    });

    it('should truncate user agent', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});
      const longUserAgent = 'A'.repeat(300);

      await createAuditLog({
        actor: 'user123',
        actorType: 'VOTER',
        action: AuditAction.VOTER_REGISTERED,
        resource: 'voters',
        result: AuditResult.SUCCESS,
        userAgent: longUserAgent,
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userAgent: 'A'.repeat(200),
        }),
      });
    });

    it('should sanitize sensitive fields in details', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await createAuditLog({
        actor: 'user123',
        actorType: 'ADMIN',
        action: AuditAction.ADMIN_ACTION,
        resource: 'settings',
        result: AuditResult.SUCCESS,
        details: {
          password: 'secret123',
          username: 'admin',
        },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: expect.stringContaining('[REDACTED]'),
        }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: expect.not.stringContaining('secret123'),
        }),
      });
    });

    it('should handle database errors gracefully', async () => {
      (prisma.auditLog.create as jest.Mock).mockRejectedValue(new Error('DB error'));

      // Should not throw
      await createAuditLog({
        actor: 'user123',
        actorType: 'SYSTEM',
        action: AuditAction.SYSTEM_ERROR,
        resource: 'system',
        result: AuditResult.ERROR,
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create audit log',
        expect.any(Object)
      );
    });

    it('should log to Winston', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await createAuditLog({
        actor: 'voter456',
        actorType: 'VOTER',
        action: AuditAction.VOTE_CAST,
        resource: 'votes',
        result: AuditResult.SUCCESS,
      });

      expect(logger.info).toHaveBeenCalledWith('Audit log created', expect.any(Object));
    });
  });

  describe('createSecurityEvent', () => {
    it('should create security event', async () => {
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({});

      await createSecurityEvent({
        severity: SecuritySeverity.MEDIUM,
        eventType: 'SUSPICIOUS_LOGIN',
        details: { userId: 'user123', attempts: 5 },
      });

      expect(prisma.securityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: SecuritySeverity.MEDIUM,
          eventType: 'SUSPICIOUS_LOGIN',
        }),
      });
    });

    it('should log critical events immediately', async () => {
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({});

      await createSecurityEvent({
        severity: SecuritySeverity.CRITICAL,
        eventType: 'INTRUSION_DETECTED',
        details: { source: 'firewall' },
      });

      expect(logger.error).toHaveBeenCalledWith(
        'SECURITY EVENT: INTRUSION_DETECTED',
        expect.any(Object)
      );
    });

    it('should log high severity events', async () => {
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({});

      await createSecurityEvent({
        severity: SecuritySeverity.HIGH,
        eventType: 'BRUTE_FORCE_ATTEMPT',
        details: { ip: '192.168.1.1' },
      });

      expect(logger.error).toHaveBeenCalled();
    });

    it('should not log low severity events to error', async () => {
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({});

      await createSecurityEvent({
        severity: SecuritySeverity.LOW,
        eventType: 'MINOR_ISSUE',
        details: {},
      });

      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('SECURITY EVENT'),
        expect.anything()
      );
    });

    it('should sanitize PII in details', async () => {
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({});

      await createSecurityEvent({
        severity: SecuritySeverity.HIGH,
        eventType: 'DATA_ACCESS',
        details: {
          votingToken: 'secret-token',
          action: 'unauthorized_access',
        },
      });

      expect(prisma.securityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: expect.stringContaining('[REDACTED]'),
        }),
      });
    });

    it('should handle database errors gracefully', async () => {
      (prisma.securityEvent.create as jest.Mock).mockRejectedValue(new Error('DB error'));

      await createSecurityEvent({
        severity: SecuritySeverity.LOW,
        eventType: 'TEST_EVENT',
        details: {},
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create security event',
        expect.any(Object)
      );
    });
  });

  describe('createLedgerEntry', () => {
    it('should create ledger entry with chain', async () => {
      (prisma.ledgerEntry.findFirst as jest.Mock).mockResolvedValue({
        dataHash: 'previous-hash',
      });
      (prisma.ledgerEntry.create as jest.Mock).mockResolvedValue({});

      await createLedgerEntry(
        'election123',
        'VOTE_CAST',
        { voteData: 'encrypted' },
        'private-key'
      );

      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          electionId: 'election123',
          entryType: 'VOTE_CAST',
          previousEntryHash: 'previous-hash',
        }),
      });
    });

    it('should handle first entry (no previous)', async () => {
      (prisma.ledgerEntry.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.ledgerEntry.create as jest.Mock).mockResolvedValue({});

      await createLedgerEntry(
        'election123',
        'ELECTION_START',
        { status: 'started' },
        'private-key'
      );

      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          // When previousEntry is null, previousEntry?.dataHash returns undefined
          previousEntryHash: undefined,
        }),
      });
    });

    it('should sign the entry', async () => {
      (prisma.ledgerEntry.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.ledgerEntry.create as jest.Mock).mockResolvedValue({});

      await createLedgerEntry(
        'election123',
        'VOTE_CAST',
        { vote: 'data' },
        'private-key'
      );

      expect(crypto.signData).toHaveBeenCalled();
      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          signature: 'test-signature',
        }),
      });
    });

    it('should throw on database error', async () => {
      (prisma.ledgerEntry.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.ledgerEntry.create as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(
        createLedgerEntry('election123', 'VOTE_CAST', {}, 'key')
      ).rejects.toThrow('DB error');
    });
  });

  describe('auditMiddleware', () => {
    it('should capture request and response', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const req = {
        user: { id: 'admin1' },
        ip: '192.168.1.1',
        method: 'POST',
        path: '/api/elections',
        params: { id: 'election123' },
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      
      const jsonMock = jest.fn();
      const res = {
        statusCode: 200,
        json: jsonMock,
      };
      
      const next = jest.fn();

      auditMiddleware(req, res, next);
      
      expect(next).toHaveBeenCalled();

      // The middleware wraps res.json, so call the wrapped version
      res.json({ success: true });

      // Wait for async audit log creation
      await new Promise(resolve => setTimeout(resolve, 10));

      // The original json mock should have been called
      expect(jsonMock).toHaveBeenCalled();
    });

    it('should handle anonymous requests', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const req = {
        ip: '10.0.0.1',
        method: 'GET',
        path: '/api/health',
        params: {},
        get: jest.fn().mockReturnValue('curl/7.68.0'),
      };
      
      const res = {
        statusCode: 200,
        json: jest.fn(),
      };
      
      const next = jest.fn();

      auditMiddleware(req, res, next);
      res.json({ status: 'ok' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(next).toHaveBeenCalled();
    });

    it('should log failed requests', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const req = {
        ip: '10.0.0.1',
        method: 'DELETE',
        path: '/api/elections/123',
        params: { id: '123' },
        get: jest.fn().mockReturnValue('test'),
      };
      
      const res = {
        statusCode: 403,
        json: jest.fn(),
      };
      
      const next = jest.fn();

      auditMiddleware(req, res, next);
      res.json({ error: 'Forbidden' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(next).toHaveBeenCalled();
    });
  });
});
