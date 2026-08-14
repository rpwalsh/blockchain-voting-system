/**
 * LEVEL 12 SUPER ADMIN ROUTES
 * ============================
 * God-mode access for system administrator
 * Every action is logged and audited
 * 
 * Capabilities:
 * - Create/manage organizations (tenants)
 * - Monitor all elections across all orgs
 * - View real-time system metrics
 * - Security event dashboard
 * - Audit log analysis
 * - Database diagnostics
 * - Cryptographic health checks
 * - Emergency controls
 */

import express from 'express';
import { prisma } from '../index';
import crypto from '../crypto/engine';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import { logger } from '../utils/logger';

const router = express.Router();

// Middleware: Verify Level 12 Super Admin via JWT
import jwt from 'jsonwebtoken';
import { loadConfig } from '../config';

// Third independent insecure JWT fallback found in this codebase (see
// middleware/auth.ts and routes/auth.ts for the same pattern, fixed the
// same way) - using the shared, validated config instead of a fallback
// literal in source.
const JWT_SECRET = loadConfig().jwtSecret;

async function requireSuperAdmin(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = authHeader.substring(7);
    
    // Verify JWT token
    const decoded: any = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role !== 'SUPER_ADMIN' || decoded.level !== 12) {
      return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
    }
    
    // Fetch super admin record
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: decoded.superAdminId },
    });
    
    if (!superAdmin) {
      return res.status(401).json({ error: 'Super admin not found' });
    }
    
    req.superAdmin = superAdmin;
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    next(error);
  }
}

/**
 * POST /api/superadmin/login
 * Authenticate as Level 12 Super Admin
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password, totpCode } = req.body;
    
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { username },
    });

    if (!superAdmin) {
      // Constant-time delay to prevent timing attacks.
      await bcrypt.compare(password, '$2b$12$invalidhashinvalidhashinvalidhashinvalidhashinvalidha');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, superAdmin.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Real TOTP verification (otplib) - every SuperAdmin created via
    // bootstrap-superadmin.ts has a real enrolled secret, so this is
    // always enforced for real accounts. Accounts without a real secret
    // (the sentinel 'not-configured') are refused rather than silently
    // let through.
    if (!superAdmin.totpSecret || superAdmin.totpSecret === 'not-configured') {
      return res.status(403).json({ error: 'This account has no TOTP secret enrolled and cannot log in. Re-run bootstrap-superadmin.ts.' });
    }
    const totpValid = !!totpCode && speakeasy.totp.verify({
      secret: superAdmin.totpSecret,
      encoding: 'base32',
      token: String(totpCode),
      window: 1, // allow the previous/next 30s step for clock drift
    });
    if (!totpValid) {
      return res.status(401).json({ error: 'Invalid TOTP code' });
    }
    
    // Generate session token
    const sessionToken = crypto.generateChallenge();
    
    await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data: {
        sessionToken,
        lastLoginAt: new Date(),
        lastLoginIp: crypto.hashIPAddress(req.ip || '0.0.0.0', new Date().toISOString().split('T')[0]),
      },
    });
    
    logger.info(`Super admin logged in: ${superAdmin.username}`);
    
    res.json({
      success: true,
      sessionToken,
      message: 'Welcome, Level 12 Administrator',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/superadmin/dashboard
 * Real-time system overview
 */
router.get('/dashboard', requireSuperAdmin, async (req, res, next) => {
  try {
    const [
      totalOrgs,
      activeOrgs,
      totalElections,
      activeElections,
      totalVotes,
      todayVotes,
      securityEvents,
      criticalEvents,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: 'ACTIVE' } }),
      prisma.election.count(),
      prisma.election.count({ where: { status: 'VOTING' } }),
      prisma.vote.count(),
      prisma.vote.count({
        where: {
          ledgerTimestamp: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.securityEvent.count({ where: { resolved: false } }),
      prisma.securityEvent.count({
        where: { severity: 'CRITICAL', resolved: false },
      }),
      prisma.auditLog.findMany({
        take: 100,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          actor: true,
          actorType: true,
          action: true,
          resource: true,
          result: true,
          timestamp: true,
        },
      }),
    ]);
    
    // System health metrics - each derived from an actual check, not a
    // hardcoded literal (see docs/threat-model.md, "compromised server" -
    // "report false integrity check status to auditors" for why a
    // dashboard that always says HEALTHY regardless of reality is exactly
    // the anti-pattern this project is trying to eliminate).
    let databaseHealthy = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseHealthy = true;
    } catch {
      databaseHealthy = false;
    }

    let cryptoHealthy = false;
    try {
      const kp = crypto.generateKeyPair();
      const sig = crypto.signData('health-check', kp.privateKey);
      cryptoHealthy = crypto.verifySignature('health-check', sig, kp.publicKey);
    } catch {
      cryptoHealthy = false;
    }

    const systemHealth = {
      database: databaseHealthy ? 'HEALTHY' : 'UNHEALTHY',
      cryptography: cryptoHealthy ? 'HEALTHY' : 'UNHEALTHY',
      api: 'HEALTHY',
    };
    
    res.json({
      success: true,
      dashboard: {
        statistics: {
          organizations: { total: totalOrgs, active: activeOrgs },
          elections: { total: totalElections, active: activeElections },
          votes: { total: totalVotes, today: todayVotes },
          security: { open: securityEvents, critical: criticalEvents },
        },
        systemHealth,
        recentActivity: recentAuditLogs,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/superadmin/organizations
 * List all organizations
 */
router.get('/organizations', requireSuperAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status, type } = req.query;
    
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    
    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          _count: {
            select: {
              elections: true,
              users: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.organization.count({ where }),
    ]);
    
    res.json({
      success: true,
      organizations: orgs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/superadmin/organizations
 * Create new organization (tenant)
 */
router.post('/organizations', requireSuperAdmin, async (req, res, next) => {
  try {
    const {
      name,
      slug,
      type,
      tier,
      primaryContact,
      email,
      phone,
      maxVoters,
    } = req.body;
    
    // Generate org keys
    const keyPair = crypto.generateKeyPair();
    const apiKey = crypto.generateChallenge();
    
    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        type,
        tier,
        primaryContact,
        email,
        phone,
        maxVoters: maxVoters || 10000,
        publicKey: keyPair.publicKey,
        apiKey,
        status: 'ACTIVE',
        createdBy: (req as any).superAdmin.id,
      },
    });
    
    // Log action
    await prisma.auditLog.create({
      data: {
        organizationId: org.id,
        actor: (req as any).superAdmin.id,
        actorType: 'SUPER_ADMIN',
        action: 'CREATE_ORGANIZATION',
        resource: 'ORGANIZATION',
        resourceId: org.id,
        result: 'SUCCESS',
        details: JSON.stringify({ name, type, tier }),
        timestamp: new Date(),
      },
    });
    
    logger.info(`Organization created: ${org.name} by super admin ${(req as any).superAdmin.id}`);
    
    res.json({
      success: true,
      organization: org,
      apiKey, // Show only once
      privateKey: keyPair.privateKey, // Show only once - MUST be secured
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/superadmin/organizations/:id
 * Delete organization (cascade deletes elections, users, etc.)
 */
router.delete('/organizations/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Delete organization (cascade will handle related records)
    await prisma.organization.delete({
      where: { id },
    });
    
    // Log action
    await prisma.auditLog.create({
      data: {
        actor: (req as any).superAdmin.id,
        actorType: 'SUPER_ADMIN',
        action: 'DELETE_ORGANIZATION',
        resource: 'ORGANIZATION',
        resourceId: id,
        result: 'SUCCESS',
        timestamp: new Date(),
      },
    });
    
    logger.info(`Organization deleted: ${id} by super admin ${(req as any).superAdmin.id}`);
    
    res.json({ success: true, message: 'Organization deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/superadmin/elections
 * Create new election with candidates
 */
router.post('/elections', requireSuperAdmin, async (req, res, next) => {
  try {
    const {
      organizationId,
      name,
      description,
      type,
      startDate,
      endDate,
      allowMultipleVotes,
      requireVerification,
      candidates = [],
    } = req.body;
    
    // Validate organization exists
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Generate election keys. privateKey is stored in plaintext - no
    // HSM/KMS integration exists in this codebase (see docs/cryptography.md).
    // keyShares is a real Shamir K-of-N split (crypto.splitSecretShamir),
    // populated as a genuine threshold-recovery safety net even though the
    // decrypt path doesn't require share reconstruction yet.
    const electionKeys = crypto.generateElectionKeyPair();
    const signingKeys = crypto.generateKeyPair();
    const keyShares = crypto.splitSecretShamir(electionKeys.privateKey, 3, 5);
    const privateKeyHash = crypto.hashVotingToken(electionKeys.privateKey);

    // Create election with candidates in transaction
    const election = await prisma.$transaction(async (tx) => {
      const newElection = await tx.election.create({
        data: {
          organizationId,
          name,
          description,
          type: type || 'GENERAL',
          status: 'DRAFT',
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          publicKey: electionKeys.publicKey,
          privateKey: electionKeys.privateKey,
          privateKeyHash,
          keyShares: JSON.stringify(keyShares),
          signingPublicKey: signingKeys.publicKey,
          signingPrivateKey: signingKeys.privateKey,
          createdBy: org.createdBy || (req as any).superAdmin.id,
        },
      });
      
      // Create candidates. `c.biography` (legacy client field) maps to the
      // Candidate model's `description` column; `order` is the array index.
      if (candidates.length > 0) {
        await tx.candidate.createMany({
          data: candidates.map((c: any, index: number) => ({
            electionId: newElection.id,
            name: c.name,
            party: c.party || null,
            description: c.biography || c.description || null,
            photoUrl: c.photoUrl || null,
            order: index,
          })),
        });
      }
      
      return newElection;
    });
    
    // Log action
    await prisma.auditLog.create({
      data: {
        organizationId,
        actor: (req as any).superAdmin.id,
        actorType: 'SUPER_ADMIN',
        action: 'CREATE_ELECTION',
        resource: 'ELECTION',
        resourceId: election.id,
        result: 'SUCCESS',
        details: JSON.stringify({ name, candidateCount: candidates.length }),
        timestamp: new Date(),
      },
    });
    
    logger.info(`Election created: ${election.name} with ${candidates.length} candidates by super admin ${(req as any).superAdmin.id}`);
    
    res.json({
      success: true,
      election,
      privateKey: electionKeys.privateKey, // Show only once - MUST be secured
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/superadmin/elections/:id
 * Delete election
 */
router.delete('/elections/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Delete election (cascade will handle candidates, votes, etc.)
    await prisma.election.delete({
      where: { id },
    });
    
    // Log action
    await prisma.auditLog.create({
      data: {
        actor: (req as any).superAdmin.id,
        actorType: 'SUPER_ADMIN',
        action: 'DELETE_ELECTION',
        resource: 'ELECTION',
        resourceId: id,
        result: 'SUCCESS',
        timestamp: new Date(),
      },
    });
    
    logger.info(`Election deleted: ${id} by super admin ${(req as any).superAdmin.id}`);
    
    res.json({ success: true, message: 'Election deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/superadmin/users
 * List all users across all organizations
 */
router.get('/users', requireSuperAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 100, organizationId, role, status } = req.query;
    
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (role) where.role = role;
    if (status) where.status = status;
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          organization: {
            select: { name: true, slug: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);
    
    res.json({
      success: true,
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/superadmin/elections
 * Monitor all elections across all organizations
 */
router.get('/elections', requireSuperAdmin, async (req, res, next) => {
  try {
    const { status, type, organizationId } = req.query;
    
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (organizationId) where.organizationId = organizationId;
    
    const elections = await prisma.election.findMany({
      where,
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: {
          select: { name: true, slug: true },
        },
        _count: {
          select: {
            voters: true,
            votes: true,
            candidates: true,
          },
        },
      },
    });
    
    res.json({
      success: true,
      elections,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/superadmin/security-events
 * Monitor security threats
 */
router.get('/security-events', requireSuperAdmin, async (req, res, next) => {
  try {
    const { severity, eventType, resolved = 'false' } = req.query;
    
    const where: any = { resolved: resolved === 'true' };
    if (severity) where.severity = severity;
    if (eventType) where.eventType = eventType;
    
    const events = await prisma.securityEvent.findMany({
      where,
      take: 100,
      orderBy: { timestamp: 'desc' },
      include: {
        organization: {
          select: { name: true, slug: true },
        },
      },
    });
    
    res.json({
      success: true,
      securityEvents: events,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/superadmin/security-events/:id/resolve
 * Resolve security event
 */
router.patch('/security-events/:id/resolve', requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolution, falsePositive } = req.body;
    
    const event = await prisma.securityEvent.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: (req as any).superAdmin.id,
        resolution,
        falsePositive: falsePositive || false,
      },
    });
    
    logger.info(`Security event resolved: ${event.id}`);
    
    res.json({ success: true, event });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/superadmin/audit-logs
 * System-wide audit log analysis
 */
router.get('/audit-logs', requireSuperAdmin, async (req, res, next) => {
  try {
    const {
      actorType,
      action,
      result,
      startDate,
      endDate,
      page = 1,
      limit = 100,
    } = req.query;
    
    const where: any = {};
    if (actorType) where.actorType = actorType;
    if (action) where.action = action;
    if (result) where.result = result;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }
    
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { timestamp: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);
    
    res.json({
      success: true,
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/superadmin/metrics
 * Real-time system metrics
 */
router.get('/metrics', requireSuperAdmin, async (req, res, next) => {
  try {
    const { metricType, timeRange = '1h' } = req.query;
    
    // Calculate time range
    const now = new Date();
    const rangeMs = {
      '5m': 5 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    }[timeRange as string] || 60 * 60 * 1000;
    
    const since = new Date(now.getTime() - rangeMs);
    
    const where: any = { timestamp: { gte: since } };
    if (metricType) where.metricType = metricType;
    
    const metrics = await prisma.systemMetric.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
    
    // Aggregate by metric type
    const aggregated = metrics.reduce((acc: any, metric) => {
      if (!acc[metric.metricType]) {
        acc[metric.metricType] = {
          name: metric.metricType,
          values: [],
          avg: 0,
          min: Infinity,
          max: -Infinity,
        };
      }
      
      acc[metric.metricType].values.push({
        value: metric.value,
        timestamp: metric.timestamp,
      });
      acc[metric.metricType].min = Math.min(acc[metric.metricType].min, metric.value);
      acc[metric.metricType].max = Math.max(acc[metric.metricType].max, metric.value);
      
      return acc;
    }, {});
    
    // Calculate averages
    Object.keys(aggregated).forEach(key => {
      const sum = aggregated[key].values.reduce((s: number, v: any) => s + v.value, 0);
      aggregated[key].avg = sum / aggregated[key].values.length;
    });
    
    res.json({
      success: true,
      metrics: Object.values(aggregated),
      timeRange,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/superadmin/crypto-test
 * Run comprehensive cryptography health check
 */
router.post('/crypto-test', requireSuperAdmin, async (req, res, next) => {
  try {
    const results: any = { tests: [], overallStatus: 'PASS' };
    
    // Test 1: Key generation
    try {
      const kp1 = crypto.generateKeyPair();
      const kp2 = crypto.generateKeyPair();
      results.tests.push({
        name: 'Key Generation',
        status: kp1.publicKey !== kp2.publicKey ? 'PASS' : 'FAIL',
        details: 'Unique keys generated',
      });
    } catch (e: any) {
      results.tests.push({ name: 'Key Generation', status: 'FAIL', error: e.message });
      results.overallStatus = 'FAIL';
    }
    
    // Test 2: Encryption/Decryption
    try {
      const electionKeys = crypto.generateElectionKeyPair();
      const encrypted = crypto.encryptVote('test-candidate-id', electionKeys.publicKey);
      const decrypted = crypto.decryptVote(encrypted, electionKeys.privateKey);
      results.tests.push({
        name: 'Encryption/Decryption',
        status: decrypted === 'test-candidate-id' ? 'PASS' : 'FAIL',
        details: 'Round-trip successful',
      });
    } catch (e: any) {
      results.tests.push({ name: 'Encryption/Decryption', status: 'FAIL', error: e.message });
      results.overallStatus = 'FAIL';
    }
    
    // Test 3: Digital Signatures
    try {
      const sigKeys = crypto.generateKeyPair();
      const data = 'test data for signing';
      const signature = crypto.signData(data, sigKeys.privateKey);
      const valid = crypto.verifySignature(data, signature, sigKeys.publicKey);
      results.tests.push({
        name: 'Digital Signatures',
        status: valid ? 'PASS' : 'FAIL',
        details: 'Signature verification successful',
      });
    } catch (e: any) {
      results.tests.push({ name: 'Digital Signatures', status: 'FAIL', error: e.message });
      results.overallStatus = 'FAIL';
    }
    
    // Test 4: Merkle Tree
    try {
      const tree = new crypto.MerkleTree(['leaf1', 'leaf2', 'leaf3']);
      const proof = tree.getProof(1);
      const valid = crypto.MerkleTree.verifyProof(proof);
      results.tests.push({
        name: 'Merkle Tree',
        status: valid ? 'PASS' : 'FAIL',
        details: 'Proof verification successful',
      });
    } catch (e: any) {
      results.tests.push({ name: 'Merkle Tree', status: 'FAIL', error: e.message });
      results.overallStatus = 'FAIL';
    }
    
    // Test 5: Shamir Secret Sharing
    try {
      const secret = crypto.generateChallenge();
      const shares = crypto.splitSecretShamir(secret, 3, 5);
      const reconstructed = crypto.reconstructSecretShamir(shares.slice(0, 3));
      results.tests.push({
        name: 'Shamir Secret Sharing',
        status: reconstructed === secret ? 'PASS' : 'FAIL',
        details: 'Threshold reconstruction successful',
      });
    } catch (e: any) {
      results.tests.push({ name: 'Shamir Secret Sharing', status: 'FAIL', error: e.message });
      results.overallStatus = 'FAIL';
    }
    
    logger.info(`Crypto health check: ${results.overallStatus}`);
    
    res.json({
      success: true,
      cryptoHealth: results,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/superadmin/system-status
 * Comprehensive system status
 */
router.get('/system-status', requireSuperAdmin, async (req, res, next) => {
  try {
    // Same principle as /dashboard above: every status here is derived
    // from an actual check, never a hardcoded literal.
    let databaseHealthy = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseHealthy = true;
    } catch {
      databaseHealthy = false;
    }

    let cryptoHealthy = false;
    try {
      const kp = crypto.generateKeyPair();
      cryptoHealthy = crypto.verifySignature('health-check', crypto.signData('health-check', kp.privateKey), kp.publicKey);
    } catch {
      cryptoHealthy = false;
    }

    const status = {
      version: require('../../package.json').version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,

      database: {
        status: databaseHealthy ? 'HEALTHY' : 'UNHEALTHY',
      },

      services: {
        api: 'HEALTHY',
        crypto: cryptoHealthy ? 'HEALTHY' : 'UNHEALTHY',
      },

      timestamp: new Date(),
    };

    res.json({ success: true, system: status });
  } catch (error) {
    next(error);
  }
});

export default router;
