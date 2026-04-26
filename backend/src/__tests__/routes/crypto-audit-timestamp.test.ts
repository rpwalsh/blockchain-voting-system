/**
 * Crypto Audit Timestamp Monotonicity Tests
 * Tests for uncovered timestamp validation paths (lines 320-321)
 */

import request from 'supertest';
import express from 'express';
import { prisma } from '../../index';
import router from '../../routes/crypto-audit';

// Mock Prisma
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

// Mock crypto engine
jest.mock('../../crypto/engine', () => {
  const mockMerkleTree = jest.fn().mockImplementation((leaves: string[]) => ({
    getRoot: jest.fn().mockReturnValue('mock-merkle-root-hash'),
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
      verifySignature: jest.fn().mockReturnValue(true),
      createReceiptHash: jest.fn().mockImplementation((vote: any) => {
        return `receipt-${vote.id}`;
      }),
      signData: jest.fn().mockReturnValue('test-signature'),
    },
    MerkleTree: mockMerkleTree,
  };
});

const app = express();
app.use(express.json());
app.use('/api/crypto-audit', router);

describe('Crypto Audit - Timestamp Monotonicity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /election/:id/integrity - Timestamp checks', () => {
    it('should detect non-monotonic timestamps in ledger entries', async () => {
      const mockElection = {
        id: 'e1',
        name: 'Test Election',
        status: 'COMPLETED',
      };

      // Create ledger entries with backwards timestamp
      const mockLedgerEntries = [
        {
          id: 'entry1',
          voteId: 'v1',
          merkleRoot: 'root1',
          blockchainAnchor: 'anchor1',
          timestamp: new Date('2026-01-10T10:00:00Z'),
        },
        {
          id: 'entry2',
          voteId: 'v2',
          merkleRoot: 'root2',
          blockchainAnchor: 'anchor2',
          timestamp: new Date('2026-01-10T09:59:00Z'), // Earlier than previous!
        },
        {
          id: 'entry3',
          voteId: 'v3',
          merkleRoot: 'root3',
          blockchainAnchor: 'anchor3',
          timestamp: new Date('2026-01-10T10:01:00Z'),
        },
      ];

      const mockVotes = [
        {
          id: 'v1',
          encrypted: JSON.stringify({ ciphertext: 'c1', nonce: 'n1' }),
          receiptHash: 'hash1',
          signature: 'sig1',
        },
        {
          id: 'v2',
          encrypted: JSON.stringify({ ciphertext: 'c2', nonce: 'n2' }),
          receiptHash: 'hash2',
          signature: 'sig2',
        },
        {
          id: 'v3',
          encrypted: JSON.stringify({ ciphertext: 'c3', nonce: 'n3' }),
          receiptHash: 'hash3',
          signature: 'sig3',
        },
      ];

      (prisma.election.findUnique as jest.Mock).mockResolvedValue(mockElection);
      (prisma.ledgerEntry.findMany as jest.Mock).mockResolvedValue(mockLedgerEntries);
      (prisma.vote.findMany as jest.Mock).mockResolvedValue(mockVotes);

      const response = await request(app)
        .get('/api/crypto-audit/election/e1/integrity');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.integrityReport).toBeDefined();
      
      // Find timestamp monotonicity check
      const timestampCheck = response.body.integrityReport.checks.find(
        (c: any) => c.check === 'Timestamp Monotonicity'
      );
      
      expect(timestampCheck).toBeDefined();
      expect(timestampCheck.status).toBe('FAIL');
    });

    it('should pass timestamp check with properly ordered timestamps', async () => {
      const mockElection = {
        id: 'e1',
        name: 'Test Election',
        status: 'COMPLETED',
      };

      const mockLedgerEntries = [
        {
          id: 'entry1',
          voteId: 'v1',
          merkleRoot: 'root1',
          blockchainAnchor: 'anchor1',
          timestamp: new Date('2026-01-10T10:00:00Z'),
        },
        {
          id: 'entry2',
          voteId: 'v2',
          merkleRoot: 'root2',
          blockchainAnchor: 'anchor2',
          timestamp: new Date('2026-01-10T10:01:00Z'),
        },
        {
          id: 'entry3',
          voteId: 'v3',
          merkleRoot: 'root3',
          blockchainAnchor: 'anchor3',
          timestamp: new Date('2026-01-10T10:02:00Z'),
        },
      ];

      const mockVotes = [
        {
          id: 'v1',
          encrypted: JSON.stringify({ ciphertext: 'c1', nonce: 'n1' }),
          receiptHash: 'hash1',
          signature: 'sig1',
        },
        {
          id: 'v2',
          encrypted: JSON.stringify({ ciphertext: 'c2', nonce: 'n2' }),
          receiptHash: 'hash2',
          signature: 'sig2',
        },
        {
          id: 'v3',
          encrypted: JSON.stringify({ ciphertext: 'c3', nonce: 'n3' }),
          receiptHash: 'hash3',
          signature: 'sig3',
        },
      ];

      (prisma.election.findUnique as jest.Mock).mockResolvedValue(mockElection);
      (prisma.ledgerEntry.findMany as jest.Mock).mockResolvedValue(mockLedgerEntries);
      (prisma.vote.findMany as jest.Mock).mockResolvedValue(mockVotes);

      const response = await request(app)
        .get('/api/crypto-audit/election/e1/integrity');

      expect(response.status).toBe(200);
      
      const timestampCheck = response.body.integrityReport.checks.find(
        (c: any) => c.check === 'Timestamp Monotonicity'
      );
      
      expect(timestampCheck).toBeDefined();
      expect(timestampCheck.status).toBe('PASS');
    });

    it('should detect equal timestamps (non-strictly-increasing)', async () => {
      const mockElection = {
        id: 'e1',
        name: 'Test Election',
        status: 'COMPLETED',
      };

      const sameTime = new Date('2026-01-10T10:00:00Z');
      const mockLedgerEntries = [
        {
          id: 'entry1',
          voteId: 'v1',
          merkleRoot: 'root1',
          blockchainAnchor: 'anchor1',
          timestamp: sameTime,
        },
        {
          id: 'entry2',
          voteId: 'v2',
          merkleRoot: 'root2',
          blockchainAnchor: 'anchor2',
          timestamp: sameTime, // Same timestamp - should fail!
        },
      ];

      const mockVotes = [
        {
          id: 'v1',
          encrypted: JSON.stringify({ ciphertext: 'c1', nonce: 'n1' }),
          receiptHash: 'hash1',
          signature: 'sig1',
        },
        {
          id: 'v2',
          encrypted: JSON.stringify({ ciphertext: 'c2', nonce: 'n2' }),
          receiptHash: 'hash2',
          signature: 'sig2',
        },
      ];

      (prisma.election.findUnique as jest.Mock).mockResolvedValue(mockElection);
      (prisma.ledgerEntry.findMany as jest.Mock).mockResolvedValue(mockLedgerEntries);
      (prisma.vote.findMany as jest.Mock).mockResolvedValue(mockVotes);

      const response = await request(app)
        .get('/api/crypto-audit/election/e1/integrity');

      expect(response.status).toBe(200);
      
      const timestampCheck = response.body.integrityReport.checks.find(
        (c: any) => c.check === 'Timestamp Monotonicity'
      );
      
      expect(timestampCheck).toBeDefined();
      expect(timestampCheck.status).toBe('FAIL');
    });
  });
});
