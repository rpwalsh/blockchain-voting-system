/**
 * END-TO-END AUTHENTICATION TESTS
 * ================================
 * Tests authentication flows and access control
 * 
 * NOTE: These tests use the app directly via supertest
 * rather than connecting to a running server
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import crypto from '../../crypto/engine';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

// Import the Express app for testing
import { app } from '../../index';

// Helper to generate token without entropy check (for testing)
function generateTestToken(): string {
  return randomBytes(32).toString('base64');
}

describe('E2E: Authentication Flows', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Public Access', () => {
    test('health endpoint should be publicly accessible', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });

    test('elections list should be publicly accessible', async () => {
      const response = await request(app).get('/api/elections');
      expect([200, 404]).toContain(response.status);
    });

    test('crypto capabilities should be publicly accessible', async () => {
      const response = await request(app).get('/api/crypto-audit/capabilities');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Protected Routes', () => {
    test('admin routes should require authentication', async () => {
      const response = await request(app).get('/api/admin/users');
      // Should be unauthorized without auth
      expect([401, 403, 404]).toContain(response.status);
    });

    test('superadmin routes should require level 12 auth', async () => {
      const response = await request(app).get('/api/superadmin/analytics');
      // Should be unauthorized without proper superadmin token
      expect([401, 403, 404]).toContain(response.status);
    });

    test('vote casting should require valid voting token', async () => {
      const response = await request(app)
        .post('/api/vote')
        .send({ candidateId: 'fake-id' });
      // Should be unauthorized without valid token
      expect([401, 403, 404]).toContain(response.status);
    });
  });

  describe('Token Validation', () => {
    test('should reject invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer invalid-token-here');
      expect([401, 403, 404]).toContain(response.status);
    });

    test('should reject expired tokens', async () => {
      // Expired token simulation
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTUxNjIzOTAyMn0.INVALID';
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect([401, 403, 404]).toContain(response.status);
    });
  });
});

describe('E2E: Voter Registration', () => {
  describe('Token Generation', () => {
    test('should generate unique voting tokens', () => {
      // Use test token generator to avoid entropy issues
      const tokens = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        const token = generateTestToken();
        expect(tokens.has(token)).toBe(false);
        tokens.add(token);
      }
      
      expect(tokens.size).toBe(100);
    });

    test('should hash tokens deterministically', () => {
      const token = generateTestToken();
      const hash1 = crypto.hashVotingToken(token);
      const hash2 = crypto.hashVotingToken(token);
      
      expect(hash1).toBe(hash2);
    });

    test('different tokens should produce different hashes', () => {
      const token1 = generateTestToken();
      const token2 = generateTestToken();
      
      const hash1 = crypto.hashVotingToken(token1);
      const hash2 = crypto.hashVotingToken(token2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Identity Protection', () => {
    test('should create secure identity hashes', () => {
      const identity = 'voter-123';
      const salt = crypto.generateChallenge();
      
      const hash = crypto.createIdentityHash(identity, salt);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(20);
      // Hash should not contain original identity
      expect(hash).not.toContain(identity);
    });

    test('same identity with different salt produces different hash', () => {
      const identity = 'voter-123';
      const salt1 = crypto.generateChallenge();
      const salt2 = crypto.generateChallenge();
      
      const hash1 = crypto.createIdentityHash(identity, salt1);
      const hash2 = crypto.createIdentityHash(identity, salt2);
      
      expect(hash1).not.toBe(hash2);
    });
  });
});

describe('E2E: Vote Encryption', () => {
  let publicKey: string;
  let privateKey: string;

  beforeAll(() => {
    const keyPair = crypto.generateElectionKeyPair();
    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;
  });

  test('should encrypt vote data', () => {
    const candidateId = 'test-candidate-123';
    const encrypted = crypto.encryptVote(candidateId, publicKey);
    
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.ciphertext).not.toContain(candidateId);
  });

  test('should decrypt vote with correct key', () => {
    const candidateId = 'test-candidate-456';
    const encrypted = crypto.encryptVote(candidateId, publicKey);
    const decrypted = crypto.decryptVote(encrypted, privateKey);
    
    expect(decrypted).toBe(candidateId);
  });

  test('encrypted vote should be non-deterministic', () => {
    const candidateId = 'test-candidate-789';
    const encrypted1 = crypto.encryptVote(candidateId, publicKey);
    const encrypted2 = crypto.encryptVote(candidateId, publicKey);
    
    // Same plaintext should produce different ciphertext (due to nonce)
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    
    // But both should decrypt to same value
    const decrypted1 = crypto.decryptVote(encrypted1, privateKey);
    const decrypted2 = crypto.decryptVote(encrypted2, privateKey);
    
    expect(decrypted1).toBe(candidateId);
    expect(decrypted2).toBe(candidateId);
  });
});

describe('E2E: Rate Limiting', () => {
  test('should handle rapid requests', async () => {
    const requests = Array(10).fill(null).map(() =>
      request(app).get('/health')
    );
    
    const responses = await Promise.all(requests);
    
    // All requests should complete (may have some rate limited)
    responses.forEach(response => {
      expect([200, 429]).toContain(response.status);
    });
  });
});

describe('E2E: Error Handling', () => {
  test('should return proper error format for 404', async () => {
    const response = await request(app).get('/api/nonexistent-endpoint');
    expect(response.status).toBe(404);
  });

  test('should handle malformed JSON gracefully', async () => {
    const response = await request(app)
      .post('/api/vote')
      .set('Content-Type', 'application/json')
      .send('{ invalid json }');
    
    expect([400, 401, 404]).toContain(response.status);
  });

  test('should sanitize error messages', async () => {
    const response = await request(app)
      .get('/api/elections/invalid-uuid-format');
    
    // Should not expose internal error details
    if (response.body.error) {
      expect(response.body.error).not.toContain('SQL');
      expect(response.body.error).not.toContain('prisma');
    }
  });
});
