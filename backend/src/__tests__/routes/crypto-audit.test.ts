/**
 * Crypto Audit Routes Tests
 * Public verifiability and cryptographic proof tests
 */

import request from 'supertest';
import express from 'express';
import { prisma } from '../../index';
import cryptoAuditRoutes from '../../routes/crypto-audit';
import crypto, { MerkleTree } from '../../crypto/engine';

// Mock dependencies
jest.mock('../../index', () => ({
  prisma: {
    election: {
      findUnique: jest.fn(),
    },
    vote: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    ledgerEntry: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../crypto/engine', () => {
  const mockMerkleTree = jest.fn().mockImplementation((leaves: string[]) => ({
    getRoot: jest.fn().mockReturnValue('mock-merkle-root-hash-12345678901234567890'),
    getProof: jest.fn().mockReturnValue({
      root: 'mock-merkle-root',
      leaf: 'leaf-data',
      leafIndex: 0,
      proof: [{ hash: 'hash1', direction: 'left' }],
    }),
  }));
  
  (mockMerkleTree as any).verifyProof = jest.fn().mockReturnValue(true);
  
  return {
    __esModule: true,
    default: {
      generateKeyPair: jest.fn().mockReturnValue({
        publicKey: 'test-public-key-1234567890',
        privateKey: 'test-private-key',
        algorithm: 'Ed25519',
      }),
      generateElectionKeyPair: jest.fn().mockReturnValue({
        publicKey: 'election-public-key',
        privateKey: 'election-private-key',
      }),
      encryptVote: jest.fn().mockReturnValue({
        ciphertext: 'encrypted-vote-ciphertext-12345678901234567890',
        algorithm: 'Curve25519-XSalsa20-Poly1305',
        version: '2.0',
      }),
      signData: jest.fn().mockReturnValue('signature-12345678901234567890'),
      splitSecretShamir: jest.fn().mockReturnValue([
        { x: 1, share: 'share1-data' },
        { x: 2, share: 'share2-data' },
        { x: 3, share: 'share3-data' },
        { x: 4, share: 'share4-data' },
        { x: 5, share: 'share5-data' },
      ]),
      generateTokenValidityProof: jest.fn().mockResolvedValue({
        protocol: 'groth16',
        curve: 'bn128',
        publicInputs: ['12345678901234567890'],
      }),
      computeTokenCommitment: jest.fn().mockResolvedValue('12345678901234567890'),
      verifyTokenValidityProof: jest.fn().mockResolvedValue(true),
      generateVotingToken: jest.fn().mockReturnValue('voting-token-123'),
      generateChallenge: jest.fn().mockReturnValue('challenge-456'),
      createReceiptHash: jest.fn().mockReturnValue('receipt-hash-12345678901234567890'),
    },
    MerkleTree: mockMerkleTree,
  };
});

const app = express();
app.use(express.json());
app.use('/api/crypto-audit', cryptoAuditRoutes);

describe('Crypto Audit Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/crypto-audit/capabilities', () => {
    it('should return system capabilities', async () => {
      const response = await request(app)
        .get('/api/crypto-audit/capabilities');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.capabilities).toBeDefined();
      expect(response.body.capabilities.encryption).toBeDefined();
      expect(response.body.capabilities.signatures).toBeDefined();
      expect(response.body.capabilities.merkleTree).toBeDefined();
      expect(response.body.capabilities.thresholdCrypto).toBeDefined();
    });

    // The competitor-disparagement "comparison" block (vs. Smartmatic) and
    // the unfounded "compliance" list (FIPS/Common Criteria/SOC 2/ISO 27001
    // with no actual audit behind any of them) have been removed from this
    // endpoint - see docs/cryptography.md for the correction. These tests
    // now check that each primitive honestly reports real vs. fallback
    // status instead of asserting marketing content that shouldn't exist.
    it('should report real vs. fallback status per zero-knowledge primitive', async () => {
      const response = await request(app)
        .get('/api/crypto-audit/capabilities');

      expect(response.body.capabilities.zeroKnowledge.tokenValidity.status).toMatch(/real/i);
      expect(response.body.capabilities.zeroKnowledge.voteValidity.status).toMatch(/not implemented/i);
    });

    it('should not claim any compliance certification', async () => {
      const response = await request(app)
        .get('/api/crypto-audit/capabilities');

      expect(response.body.compliance).toBeUndefined();
      expect(response.body.comparison).toBeUndefined();
    });
  });

  describe('GET /api/crypto-audit/live-demo', () => {
    it('should run live cryptographic demonstrations', async () => {
      const response = await request(app)
        .get('/api/crypto-audit/live-demo');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.demonstrations).toBeInstanceOf(Array);
      expect(response.body.demonstrations.length).toBeGreaterThan(0);
      expect(response.body.totalDuration).toBeDefined();
    });

    it('should demonstrate key generation', async () => {
      const response = await request(app)
        .get('/api/crypto-audit/live-demo');

      const keyGenDemo = response.body.demonstrations.find(
        (d: any) => d.operation.includes('Key Generation')
      );
      expect(keyGenDemo).toBeDefined();
      expect(keyGenDemo.status).not.toBe('FAIL');
    });

    it('should demonstrate vote encryption', async () => {
      const response = await request(app)
        .get('/api/crypto-audit/live-demo');

      const encryptDemo = response.body.demonstrations.find(
        (d: any) => d.operation.includes('Encryption')
      );
      expect(encryptDemo).toBeDefined();
      expect(encryptDemo.result.algorithm).toBeDefined();
    });

    it('should demonstrate Merkle tree', async () => {
      const response = await request(app)
        .get('/api/crypto-audit/live-demo');

      const merkleDemo = response.body.demonstrations.find(
        (d: any) => d.operation.includes('Merkle Tree')
      );
      expect(merkleDemo).toBeDefined();
    });

    it('should demonstrate Shamir secret sharing', async () => {
      const response = await request(app)
        .get('/api/crypto-audit/live-demo');

      const shamirDemo = response.body.demonstrations.find(
        (d: any) => d.operation.includes('Shamir')
      );
      expect(shamirDemo).toBeDefined();
      expect(shamirDemo.result.totalShares).toBe(5);
      expect(shamirDemo.result.threshold).toBe(3);
    });
  });

  describe('GET /api/crypto-audit/election/:id/integrity', () => {
    it('should return 404 for non-existent election', async () => {
      (prisma.election.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/crypto-audit/election/non-existent/integrity');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Election not found');
    });

    it('should perform integrity check on election', async () => {
      (prisma.election.findUnique as jest.Mock).mockResolvedValue({
        id: 'election1',
        name: 'Test Election',
        status: 'VOTING',
      });
      (prisma.vote.findMany as jest.Mock).mockResolvedValue([
        { id: 'vote1', encryptedVote: 'encrypted1' },
        { id: 'vote2', encryptedVote: 'encrypted2' },
      ]);
      (prisma.ledgerEntry.findMany as jest.Mock).mockResolvedValue([
        { id: 'entry1', entryType: 'VOTE_CAST', timestamp: new Date('2025-01-01') },
        { id: 'entry2', entryType: 'VOTE_CAST', timestamp: new Date('2025-01-02') },
      ]);

      const response = await request(app)
        .get('/api/crypto-audit/election/election1/integrity');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.integrityReport).toBeDefined();
      expect(response.body.integrityReport.checks).toBeInstanceOf(Array);
    });

    it('should verify vote count integrity', async () => {
      (prisma.election.findUnique as jest.Mock).mockResolvedValue({
        id: 'election1',
        name: 'Test Election',
        status: 'COMPLETED',
      });
      (prisma.vote.findMany as jest.Mock).mockResolvedValue([
        { id: 'vote1', encryptedVote: 'encrypted1' },
      ]);
      (prisma.ledgerEntry.findMany as jest.Mock).mockResolvedValue([
        { id: 'entry1', entryType: 'VOTE_CAST', timestamp: new Date() },
      ]);

      const response = await request(app)
        .get('/api/crypto-audit/election/election1/integrity');

      const voteCountCheck = response.body.integrityReport.checks.find(
        (c: any) => c.check === 'Vote Count Integrity'
      );
      expect(voteCountCheck).toBeDefined();
      expect(voteCountCheck.status).toBe('PASS');
    });

    it('should handle election with no votes', async () => {
      (prisma.election.findUnique as jest.Mock).mockResolvedValue({
        id: 'election1',
        name: 'Empty Election',
        status: 'CREATED',
      });
      (prisma.vote.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ledgerEntry.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/crypto-audit/election/election1/integrity');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/crypto-audit/verify-receipt', () => {
    it('should require receiptHash', async () => {
      const response = await request(app)
        .post('/api/crypto-audit/verify-receipt')
        .send({ electionId: 'election1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('receiptHash and electionId required');
    });

    it('should require electionId', async () => {
      const response = await request(app)
        .post('/api/crypto-audit/verify-receipt')
        .send({ receiptHash: 'hash123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('receiptHash and electionId required');
    });

    it('should return not found for invalid receipt', async () => {
      (prisma.vote.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/crypto-audit/verify-receipt')
        .send({
          receiptHash: 'invalid-receipt',
          electionId: 'election1',
        });

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(false);
      expect(response.body.message).toBe('No vote found with this receipt hash');
    });

    it('should verify valid receipt', async () => {
      (prisma.vote.findFirst as jest.Mock).mockResolvedValue({
        id: 'vote1',
        receiptHash: 'valid-receipt',
        encryptedVote: 'encrypted-vote',
        electionId: 'election1',
        election: {
          id: 'election1',
          name: 'Presidential Election',
        },
      });
      (prisma.vote.findMany as jest.Mock).mockResolvedValue([
        { id: 'vote1', encryptedVote: 'encrypted-vote', ledgerTimestamp: new Date() },
      ]);

      const response = await request(app)
        .post('/api/crypto-audit/verify-receipt')
        .send({
          receiptHash: 'valid-receipt',
          electionId: 'election1',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.verified).toBe(true);
      expect(response.body.verification.electionName).toBe('Presidential Election');
    });
  });

  describe('GET /api/crypto-audit/election/:id/merkle-tree', () => {
    it('should handle election with no votes', async () => {
      (prisma.vote.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/crypto-audit/election/election1/merkle-tree');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.merkleTree).toBeNull();
      expect(response.body.message).toBe('No votes yet');
    });

    it('should return merkle tree for election with votes', async () => {
      (prisma.vote.findMany as jest.Mock).mockResolvedValue([
        { encryptedVote: 'vote1', receiptHash: 'receipt1', ledgerTimestamp: new Date() },
        { encryptedVote: 'vote2', receiptHash: 'receipt2', ledgerTimestamp: new Date() },
      ]);

      const response = await request(app)
        .get('/api/crypto-audit/election/election1/merkle-tree');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.merkleTree).toBeDefined();
      expect(response.body.merkleTree.root).toBeDefined();
      expect(response.body.merkleTree.totalLeaves).toBe(2);
      expect(response.body.explanation).toBeDefined();
    });
  });

  describe('GET /api/crypto-audit/algorithms', () => {
    it('should return algorithm documentation', async () => {
      const response = await request(app)
        .get('/api/crypto-audit/algorithms');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.algorithms).toBeInstanceOf(Array);
      expect(response.body.algorithms.length).toBeGreaterThan(0);
    });

    it('should include Curve25519', async () => {
      const response = await request(app)
        .get('/api/crypto-audit/algorithms');

      const curve25519 = response.body.algorithms.find(
        (a: any) => a.name === 'Curve25519'
      );
      expect(curve25519).toBeDefined();
      expect(curve25519.type).toBe('Elliptic Curve');
    });

    it('should include Ed25519', async () => {
      const response = await request(app)
        .get('/api/crypto-audit/algorithms');

      const ed25519 = response.body.algorithms.find(
        (a: any) => a.name === 'Ed25519'
      );
      expect(ed25519).toBeDefined();
      expect(ed25519.type).toBe('Digital Signature');
    });

    it('should not claim FIPS/compliance certification, and should point to the real correction', async () => {
      const response = await request(app)
        .get('/api/crypto-audit/algorithms');

      // See docs/cryptography.md.
      expect(response.body.compliance).toBeUndefined();
      expect(response.body.note).toMatch(/not.*(FIPS|certification)/i);
    });
  });

  describe('Error handling', () => {
    it('GET /election/:id/integrity should handle database errors', async () => {
      (prisma.election.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/crypto-audit/election/election1/integrity');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });

    it('POST /verify-receipt should handle database errors', async () => {
      (prisma.vote.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/crypto-audit/verify-receipt')
        .send({ receiptHash: 'receipt123', electionId: 'election1' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });

    it('GET /election/:id/merkle-tree should handle database errors', async () => {
      (prisma.vote.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/crypto-audit/election/election1/merkle-tree');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });
});
