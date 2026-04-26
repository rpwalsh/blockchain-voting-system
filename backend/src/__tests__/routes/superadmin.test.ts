/**
 * Super Admin Routes Tests
 * Level 12 administrative access tests
 */

import request from 'supertest';
import express from 'express';
import { prisma } from '../../index';
import superadminRoutes from '../../routes/superadmin';
import bcrypt from 'bcrypt';
import crypto from '../../crypto/engine';

// Mock dependencies
jest.mock('../../index', () => ({
  prisma: {
    superAdmin: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    election: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    vote: {
      count: jest.fn(),
    },
    securityEvent: {
      count: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    systemMetric: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../crypto/engine', () => ({
  hashIPAddress: jest.fn().mockReturnValue('hashed-ip'),
  generateKeyPair: jest.fn().mockReturnValue({
    publicKey: 'test-public-key',
    privateKey: 'test-private-key',
  }),
  generateElectionKeyPair: jest.fn().mockReturnValue({
    publicKey: 'election-public-key',
    privateKey: 'election-private-key',
  }),
  generateChallenge: jest.fn().mockReturnValue('test-challenge-token'),
  encryptVote: jest.fn().mockReturnValue('encrypted-vote'),
  decryptVote: jest.fn().mockReturnValue('test-candidate-id'),
  signData: jest.fn().mockReturnValue('test-signature'),
  verifySignature: jest.fn().mockReturnValue(true),
  splitSecretShamir: jest.fn().mockReturnValue(['share1', 'share2', 'share3', 'share4', 'share5']),
  reconstructSecretShamir: jest.fn().mockReturnValue('test-challenge-token'),
  MerkleTree: jest.fn().mockImplementation(() => ({
    getProof: jest.fn().mockReturnValue({ leaf: 'leaf2', proof: [] }),
  })),
}));

// Add static method to MerkleTree mock
(crypto.MerkleTree as any).verifyProof = jest.fn().mockReturnValue(true);

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/superadmin', superadminRoutes);

describe('Super Admin Routes', () => {
  const validToken = 'valid-super-admin-token';
  const mockSuperAdmin = {
    id: 'super-admin-1',
    username: 'admin',
    passwordHash: 'hashed-password',
    sessionToken: validToken,
    lastLoginAt: new Date(),
    lastLoginIp: 'hashed-ip',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.superAdmin.findFirst as jest.Mock).mockResolvedValue(mockSuperAdmin);
  });

  describe('POST /api/superadmin/login', () => {
    it('should reject login with invalid credentials', async () => {
      (prisma.superAdmin.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post('/api/superadmin/login')
        .send({
          username: 'unknown',
          password: 'wrong',
          totpCode: '123456',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with wrong password', async () => {
      (prisma.superAdmin.findUnique as jest.Mock).mockResolvedValue(mockSuperAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post('/api/superadmin/login')
        .send({
          username: 'admin',
          password: 'wrongpassword',
          totpCode: '123456',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with invalid TOTP', async () => {
      (prisma.superAdmin.findUnique as jest.Mock).mockResolvedValue(mockSuperAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/superadmin/login')
        .send({
          username: 'admin',
          password: 'correctpassword',
          totpCode: 'invalid',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid TOTP code');
    });
  });

  describe('GET /api/superadmin/dashboard', () => {
    it('should reject unauthorized access', async () => {
      (prisma.superAdmin.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/superadmin/dashboard')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid super admin token');
    });

    it('should reject requests without auth header', async () => {
      const response = await request(app)
        .get('/api/superadmin/dashboard');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return dashboard with valid token', async () => {
      (prisma.organization.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8);
      (prisma.election.count as jest.Mock)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(5);
      (prisma.vote.count as jest.Mock)
        .mockResolvedValueOnce(154000000)
        .mockResolvedValueOnce(500000);
      (prisma.securityEvent.count as jest.Mock)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1);
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
        { id: 'log1', action: 'CREATE', actor: 'admin1' },
      ]);

      const response = await request(app)
        .get('/api/superadmin/dashboard')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.dashboard.statistics.organizations.total).toBe(10);
      expect(response.body.dashboard.statistics.elections.total).toBe(50);
      expect(response.body.dashboard.statistics.votes.total).toBe(154000000);
    });
  });

  describe('GET /api/superadmin/organizations', () => {
    it('should list organizations', async () => {
      (prisma.organization.findMany as jest.Mock).mockResolvedValue([
        { id: 'org1', name: 'Org 1', _count: { elections: 5, users: 100 } },
      ]);
      (prisma.organization.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/superadmin/organizations')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.organizations).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });

    it('should filter by status', async () => {
      (prisma.organization.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.organization.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/superadmin/organizations?status=ACTIVE')
        .set('Authorization', `Bearer ${validToken}`);

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' },
        })
      );
    });

    it('should filter by type', async () => {
      (prisma.organization.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.organization.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/superadmin/organizations?type=GOVERNMENT')
        .set('Authorization', `Bearer ${validToken}`);

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'GOVERNMENT' },
        })
      );
    });
  });

  describe('POST /api/superadmin/organizations', () => {
    it('should create organization', async () => {
      const newOrg = {
        id: 'org-new',
        name: 'New Organization',
        slug: 'new-org',
        type: 'GOVERNMENT',
        tier: 'ENTERPRISE',
      };
      
      (prisma.organization.create as jest.Mock).mockResolvedValue(newOrg);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/superadmin/organizations')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'New Organization',
          slug: 'new-org',
          type: 'GOVERNMENT',
          tier: 'ENTERPRISE',
          primaryContact: 'John Doe',
          email: 'john@gov.org',
          phone: '555-1234',
          maxVoters: 1000000,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.organization.name).toBe('New Organization');
      expect(response.body.apiKey).toBeDefined();
      expect(response.body.privateKey).toBeDefined();
    });
  });

  describe('GET /api/superadmin/elections', () => {
    it('should list all elections', async () => {
      (prisma.election.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'election1',
          name: 'Presidential Election',
          status: 'VOTING',
          organization: { name: 'Federal Gov', slug: 'fed' },
          _count: { voters: 1000, votes: 500, candidates: 3 },
        },
      ]);

      const response = await request(app)
        .get('/api/superadmin/elections')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.elections).toHaveLength(1);
    });

    it('should filter by status', async () => {
      (prisma.election.findMany as jest.Mock).mockResolvedValue([]);

      await request(app)
        .get('/api/superadmin/elections?status=VOTING')
        .set('Authorization', `Bearer ${validToken}`);

      expect(prisma.election.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'VOTING' },
        })
      );
    });
  });

  describe('GET /api/superadmin/security-events', () => {
    it('should list security events', async () => {
      (prisma.securityEvent.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'event1',
          eventType: 'INTRUSION_ATTEMPT',
          severity: 'CRITICAL',
          resolved: false,
          organization: { name: 'Org 1', slug: 'org1' },
        },
      ]);

      const response = await request(app)
        .get('/api/superadmin/security-events')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.securityEvents).toHaveLength(1);
    });

    it('should filter by severity', async () => {
      (prisma.securityEvent.findMany as jest.Mock).mockResolvedValue([]);

      await request(app)
        .get('/api/superadmin/security-events?severity=CRITICAL')
        .set('Authorization', `Bearer ${validToken}`);

      expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ severity: 'CRITICAL' }),
        })
      );
    });
  });

  describe('PATCH /api/superadmin/security-events/:id/resolve', () => {
    it('should resolve security event', async () => {
      (prisma.securityEvent.update as jest.Mock).mockResolvedValue({
        id: 'event1',
        resolved: true,
        resolvedAt: new Date(),
        resolution: 'False alarm',
      });

      const response = await request(app)
        .patch('/api/superadmin/security-events/event1/resolve')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          resolution: 'False alarm',
          falsePositive: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.event.resolved).toBe(true);
    });
  });

  describe('GET /api/superadmin/audit-logs', () => {
    it('should list audit logs', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
        { id: 'log1', action: 'CREATE', actor: 'admin1' },
      ]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/superadmin/audit-logs')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.logs).toHaveLength(1);
    });

    it('should filter by date range', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/superadmin/audit-logs?startDate=2025-01-01&endDate=2025-01-31')
        .set('Authorization', `Bearer ${validToken}`);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('should filter by action type', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/superadmin/audit-logs?action=CREATE_ORGANIZATION')
        .set('Authorization', `Bearer ${validToken}`);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'CREATE_ORGANIZATION',
          }),
        })
      );
    });
  });

  describe('GET /api/superadmin/metrics', () => {
    it('should return system metrics', async () => {
      (prisma.systemMetric.findMany as jest.Mock).mockResolvedValue([
        { metricType: 'CPU_USAGE', value: 45, timestamp: new Date() },
        { metricType: 'CPU_USAGE', value: 50, timestamp: new Date() },
        { metricType: 'MEMORY_USAGE', value: 60, timestamp: new Date() },
      ]);

      const response = await request(app)
        .get('/api/superadmin/metrics')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metrics).toBeInstanceOf(Array);
    });

    it('should filter by time range', async () => {
      (prisma.systemMetric.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/superadmin/metrics?timeRange=24h')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.body.timeRange).toBe('24h');
    });
  });

  describe('POST /api/superadmin/crypto-test', () => {
    it('should run crypto health checks', async () => {
      const response = await request(app)
        .post('/api/superadmin/crypto-test')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.cryptoHealth.tests).toBeInstanceOf(Array);
      expect(response.body.cryptoHealth.overallStatus).toBe('PASS');
    });
  });

  describe('GET /api/superadmin/system-status', () => {
    it('should return system status', async () => {
      const response = await request(app)
        .get('/api/superadmin/system-status')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.system.version).toBeDefined();
      expect(response.body.system.uptime).toBeGreaterThan(0);
      expect(response.body.system.memory).toBeDefined();
      expect(response.body.system.services).toBeDefined();
    });
  });
});
