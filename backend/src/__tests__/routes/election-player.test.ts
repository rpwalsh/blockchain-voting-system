/**
 * Election Player Routes Tests
 * Real-time visualization and playback API tests
 */

import request from 'supertest';
import express from 'express';
import { MerkleTree } from '../../crypto/engine';

// Create mock functions
const mockVoteFindMany = jest.fn();
const mockVoteFindFirst = jest.fn();
const mockVoteCount = jest.fn();
const mockElectionFindUnique = jest.fn();
const mockTallyResultFindMany = jest.fn();
const mockElectionFinalizationFindUnique = jest.fn();

// Mock Prisma before importing routes
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    vote: {
      findMany: mockVoteFindMany,
      findFirst: mockVoteFindFirst,
      count: mockVoteCount,
    },
    election: {
      findUnique: mockElectionFindUnique,
    },
    tallyResult: {
      findMany: mockTallyResultFindMany,
    },
    electionFinalization: {
      findUnique: mockElectionFinalizationFindUnique,
    },
  })),
}));

// Import after mock setup
import electionPlayerRoutes from '../../routes/election-player';

const app = express();
app.use(express.json());
app.use('/api/election-player', electionPlayerRoutes);

describe('Election Player Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/election-player/:electionId/timeline', () => {
    it('should return election timeline', async () => {
      const mockVotes = [
        {
          ledgerTimestamp: new Date('2024-11-05T08:00:00Z'),
          candidateId: 'candidate1',
          candidate: { name: 'John Doe', party: 'Republican' },
          receiptHash: 'receipt1',
          merkleProof: 'proof1',
        },
        {
          ledgerTimestamp: new Date('2024-11-05T08:01:00Z'),
          candidateId: 'candidate2',
          candidate: { name: 'Jane Smith', party: 'Democratic' },
          receiptHash: 'receipt2',
          merkleProof: 'proof2',
        },
      ];

      mockVoteFindMany.mockResolvedValue(mockVotes);

      const response = await request(app)
        .get('/api/election-player/election1/timeline');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.totalVotes).toBe(2);
      expect(response.body.timeline).toHaveLength(2);
      expect(response.body.timeline[0].sequenceNumber).toBe(1);
      expect(response.body.timeline[1].sequenceNumber).toBe(2);
    });

    it('should handle empty election', async () => {
      mockVoteFindMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/election-player/empty-election/timeline');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.totalVotes).toBe(0);
      expect(response.body.duration).toBe(0);
    });

    it('should calculate duration correctly', async () => {
      const startTime = new Date('2024-11-05T08:00:00Z');
      const endTime = new Date('2024-11-05T20:00:00Z');
      
      mockVoteFindMany.mockResolvedValue([
        { ledgerTimestamp: startTime, candidateId: 'c1', candidate: { name: 'A', party: 'GOP' }, receiptHash: 'r1', merkleProof: 'p1' },
        { ledgerTimestamp: endTime, candidateId: 'c2', candidate: { name: 'B', party: 'DEM' }, receiptHash: 'r2', merkleProof: 'p2' },
      ]);

      const response = await request(app)
        .get('/api/election-player/election1/timeline');

      expect(response.body.duration).toBe(endTime.getTime() - startTime.getTime());
    });
  });

  describe('GET /api/election-player/:electionId/snapshot/:sequenceNumber', () => {
    it('should return snapshot at sequence number', async () => {
      const mockVotes = [
        { candidateId: 'c1', candidate: { name: 'John Doe', party: 'Republican' }, ledgerTimestamp: new Date() },
        { candidateId: 'c1', candidate: { name: 'John Doe', party: 'Republican' }, ledgerTimestamp: new Date() },
        { candidateId: 'c2', candidate: { name: 'Jane Smith', party: 'Democratic' }, ledgerTimestamp: new Date() },
      ];

      mockVoteFindMany.mockResolvedValue(mockVotes);

      const response = await request(app)
        .get('/api/election-player/election1/snapshot/3');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sequenceNumber).toBe(3);
      expect(response.body.totalVotes).toBe(3);
      expect(response.body.candidates.c1.votes).toBe(2);
      expect(response.body.candidates.c2.votes).toBe(1);
    });

    it('should calculate percentages correctly', async () => {
      const mockVotes = [
        { candidateId: 'c1', candidate: { name: 'A', party: 'GOP' }, ledgerTimestamp: new Date() },
        { candidateId: 'c1', candidate: { name: 'A', party: 'GOP' }, ledgerTimestamp: new Date() },
        { candidateId: 'c1', candidate: { name: 'A', party: 'GOP' }, ledgerTimestamp: new Date() },
        { candidateId: 'c2', candidate: { name: 'B', party: 'DEM' }, ledgerTimestamp: new Date() },
      ];

      mockVoteFindMany.mockResolvedValue(mockVotes);

      const response = await request(app)
        .get('/api/election-player/election1/snapshot/4');

      expect(response.body.candidates.c1.percentage).toBe(75);
      expect(response.body.candidates.c2.percentage).toBe(25);
    });

    it('should handle snapshot with no votes', async () => {
      mockVoteFindMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/election-player/election1/snapshot/0');

      expect(response.status).toBe(200);
      expect(response.body.totalVotes).toBe(0);
      expect(response.body.timestamp).toBeNull();
    });
  });

  describe('GET /api/election-player/:electionId/stats', () => {
    it('should return 404 for non-existent election', async () => {
      mockElectionFindUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/election-player/nonexistent/stats');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Election not found');
    });

    it('should return election statistics', async () => {
      mockElectionFindUnique.mockResolvedValue({
        id: 'election1',
        name: 'Presidential Election 2024',
        status: 'COMPLETED',
        startDate: new Date('2024-11-05'),
        endDate: new Date('2024-11-05'),
        merkleRoot: 'merkle-root-hash',
        candidates: [
          { id: 'c1', name: 'Trump', party: 'Republican', description: 'MAGA' },
          { id: 'c2', name: 'Biden', party: 'Democratic', description: 'Unity' },
        ],
        _count: {
          votes: 1000000,
          voters: 1500000,
        },
      });
      mockTallyResultFindMany.mockResolvedValue([
        { candidateId: 'c1', voteCount: 520000 },
        { candidateId: 'c2', voteCount: 480000 },
      ]);

      const response = await request(app)
        .get('/api/election-player/election1/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.election.name).toBe('Presidential Election 2024');
      expect(response.body.election.totalVotes).toBe(1000000);
      expect(response.body.candidates).toHaveLength(2);
      expect(response.body.candidates[0].color).toBe('#E81B23'); // Republican red
    });

    it('should include party colors', async () => {
      mockElectionFindUnique.mockResolvedValue({
        id: 'election1',
        name: 'Test',
        status: 'VOTING',
        startDate: new Date(),
        endDate: new Date(),
        merkleRoot: 'root',
        candidates: [
          { id: 'c1', name: 'A', party: 'Republican' },
          { id: 'c2', name: 'B', party: 'Democratic' },
          { id: 'c3', name: 'C', party: 'Libertarian' },
          { id: 'c4', name: 'D', party: 'Green' },
          { id: 'c5', name: 'E', party: 'Unknown' },
        ],
        _count: { votes: 100, voters: 200 },
      });
      mockTallyResultFindMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/election-player/election1/stats');

      expect(response.body.candidates[0].color).toBe('#E81B23'); // Republican
      expect(response.body.candidates[1].color).toBe('#0015BC'); // Democratic
      expect(response.body.candidates[2].color).toBe('#FED105'); // Libertarian
      expect(response.body.candidates[3].color).toBe('#17AA5C'); // Green
      expect(response.body.candidates[4].color).toBe('#999999'); // Default
    });

    it('should handle election with no tally results', async () => {
      mockElectionFindUnique.mockResolvedValue({
        id: 'election1',
        name: 'Test',
        status: 'VOTING',
        startDate: new Date(),
        endDate: new Date(),
        merkleRoot: 'root',
        candidates: [{ id: 'c1', name: 'A', party: 'GOP' }],
        _count: { votes: 0, voters: 100 },
      });
      mockTallyResultFindMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/election-player/election1/stats');

      expect(response.body.candidates[0].votes).toBe(0);
      expect(response.body.candidates[0].percentage).toBe('0.00');
    });
  });

  describe('POST /api/election-player/:electionId/verify-vote', () => {
    it('should return 404 for non-existent vote', async () => {
      mockVoteFindFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/election-player/election1/verify-vote')
        .send({ receiptHash: 'invalid-receipt' });

      expect(response.status).toBe(404);
      expect(response.body.verified).toBe(false);
      expect(response.body.error).toBe('Vote not found');
    });

    // verify-vote now recomputes a real Merkle proof from the current vote
    // set (see routes/election-player.ts) rather than comparing two stored
    // root columns, so these fixtures need a real, internally-consistent
    // set of votes/roots for MerkleTree to work with - not placeholder
    // strings like 'matching-root' that were never actually hashed.
    it('should verify valid vote', async () => {
      const votes = [
        { id: 'v1', encryptedVote: 'ciphertext-1' },
        { id: 'v2', encryptedVote: 'ciphertext-2' },
        { id: 'v3', encryptedVote: 'ciphertext-3' },
      ];
      const tree = new MerkleTree(votes.map(v => v.encryptedVote));
      const realRoot = tree.getRoot();

      mockVoteFindFirst.mockResolvedValue({
        id: 'v2',
        receiptHash: 'valid-receipt',
        merkleRoot: realRoot,
        merkleProof: 'unused-stale-proof',
        ledgerTimestamp: new Date(),
        candidate: { name: 'John Doe' },
        election: { merkleRoot: realRoot },
      });
      mockVoteFindMany.mockResolvedValue(votes);
      mockElectionFinalizationFindUnique.mockResolvedValue(null); // not finalized - checked against live root

      const response = await request(app)
        .post('/api/election-player/election1/verify-vote')
        .send({ receiptHash: 'valid-receipt' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.verified).toBe(true);
      expect(response.body.vote.candidateName).toBe('John Doe');
    });

    it('should fail verification for mismatched merkle root', async () => {
      const votes = [
        { id: 'v1', encryptedVote: 'ciphertext-1' },
        { id: 'v2', encryptedVote: 'ciphertext-2' },
      ];

      mockVoteFindFirst.mockResolvedValue({
        id: 'v2',
        receiptHash: 'receipt',
        merkleRoot: 'stale-root-from-before-a-later-vote-was-added',
        merkleProof: 'unused-stale-proof',
        ledgerTimestamp: new Date(),
        candidate: { name: 'Jane Smith' },
        // Election's live root doesn't match what a real recomputation
        // over `votes` would produce - e.g. the DB column was tampered
        // with, or is simply stale relative to the real ledger.
        election: { merkleRoot: 'a-root-that-does-not-match-real-recomputation' },
      });
      mockVoteFindMany.mockResolvedValue(votes);
      mockElectionFinalizationFindUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/election-player/election1/verify-vote')
        .send({ receiptHash: 'receipt' });

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('GET /:electionId/timeline should handle database errors', async () => {
      jest.clearAllMocks();
      mockVoteFindMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/election-player/election1/timeline');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });

    it('GET /:electionId/snapshot/:sequenceNumber should handle database errors', async () => {
      jest.clearAllMocks();
      mockVoteFindMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/election-player/election1/snapshot/100');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });

    it('GET /:electionId/stats should handle database errors', async () => {
      jest.clearAllMocks();
      mockElectionFindUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/election-player/election1/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });

    it('POST /:electionId/verify-vote should handle database errors', async () => {
      jest.clearAllMocks();
      mockVoteFindFirst.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/election-player/election1/verify-vote')
        .send({ receiptHash: 'receipt' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });
});
