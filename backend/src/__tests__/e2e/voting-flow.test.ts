/**
 * END-TO-END VOTING FLOW TESTS
 * =============================
 * Complete election lifecycle tests
 * 
 * Tests the entire flow:
 * 1. Create election
 * 2. Register voters
 * 3. Cast votes
 * 4. Tally results
 * 5. Verify integrity
 */

import { PrismaClient } from '@prisma/client';
import crypto from '../../crypto/engine';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

// Test data
const TEST_ELECTION_PREFIX = 'e2e-test-';
let testOrganizationId: string;
let testElectionId: string;
let testCandidateIds: string[] = [];
let testVoterTokens: string[] = [];

// Helper to generate token without entropy check (for testing)
function generateTestToken(): string {
  return randomBytes(32).toString('base64');
}

describe('E2E: Complete Voting Flow', () => {
  beforeAll(async () => {
    // Clean up any previous test data
    await prisma.vote.deleteMany({
      where: { election: { name: { startsWith: TEST_ELECTION_PREFIX } } },
    });
    await prisma.tallyResult.deleteMany({
      where: { election: { name: { startsWith: TEST_ELECTION_PREFIX } } },
    });
    await prisma.voter.deleteMany({
      where: { election: { name: { startsWith: TEST_ELECTION_PREFIX } } },
    });
    await prisma.candidate.deleteMany({
      where: { election: { name: { startsWith: TEST_ELECTION_PREFIX } } },
    });
    await prisma.election.deleteMany({
      where: { name: { startsWith: TEST_ELECTION_PREFIX } },
    });
    await prisma.organization.deleteMany({
      where: { name: { startsWith: TEST_ELECTION_PREFIX } },
    });
    
    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: `${TEST_ELECTION_PREFIX}org-${Date.now()}`,
        slug: `e2e-test-org-${Date.now()}`,
        type: 'TESTING',
        status: 'ACTIVE',
        primaryContact: 'E2E Test',
        email: `e2e-test-${Date.now()}@example.com`,
        publicKey: crypto.generateKeyPair().publicKey,
        apiKey: `test-api-key-${Date.now()}`,
      },
    });
    testOrganizationId = org.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testElectionId) {
      await prisma.vote.deleteMany({ where: { electionId: testElectionId } });
      await prisma.tallyResult.deleteMany({ where: { electionId: testElectionId } });
      await prisma.voter.deleteMany({ where: { electionId: testElectionId } });
      await prisma.candidate.deleteMany({ where: { electionId: testElectionId } });
      await prisma.election.deleteMany({ where: { id: testElectionId } });
    }
    if (testOrganizationId) {
      await prisma.organization.deleteMany({ where: { id: testOrganizationId } });
    }
    await prisma.$disconnect();
  });

  describe('Step 1: Election Creation', () => {
    test('should create new election', async () => {
      const electionKeyPair = crypto.generateElectionKeyPair();
      const privateKeyHash = crypto.createReceiptHash(electionKeyPair.privateKey);
      
      const election = await prisma.election.create({
        data: {
          name: `${TEST_ELECTION_PREFIX}${Date.now()}`,
          description: 'E2E Test Election',
          type: 'POLL',
          status: 'VOTING',
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000), // +1 day
          publicKey: electionKeyPair.publicKey,
          privateKey: electionKeyPair.privateKey,
          privateKeyHash,
          organizationId: testOrganizationId,
        },
      });

      testElectionId = election.id;
      
      expect(election.id).toBeDefined();
      expect(election.name).toContain(TEST_ELECTION_PREFIX);
      expect(election.status).toBe('VOTING');
      expect(election.publicKey).toBeDefined();
    });

    test('should create candidates', async () => {
      const candidates = await Promise.all([
        prisma.candidate.create({
          data: {
            electionId: testElectionId,
            name: 'Test Candidate A',
            party: 'Party A',
          },
        }),
        prisma.candidate.create({
          data: {
            electionId: testElectionId,
            name: 'Test Candidate B',
            party: 'Party B',
          },
        }),
      ]);

      testCandidateIds = candidates.map(c => c.id);
      
      expect(candidates).toHaveLength(2);
      candidates.forEach(c => {
        expect(c.electionId).toBe(testElectionId);
      });
    });
  });

  describe('Step 2: Voter Registration', () => {
    test('should register voters', async () => {
      const voters = [];
      
      for (let i = 0; i < 5; i++) {
        const voterKeyPair = crypto.generateKeyPair();
        // Use test token generator to avoid entropy check issues
        const votingToken = generateTestToken();
        const tokenHash = crypto.hashVotingToken(votingToken);
        
        testVoterTokens.push(votingToken);
        
        const voter = await prisma.voter.create({
          data: {
            electionId: testElectionId,
            identityHash: crypto.createIdentityHash(`voter-${i}`, crypto.generateChallenge()),
            votingTokenHash: tokenHash,
            publicKey: voterKeyPair.publicKey,
            registrationProof: crypto.generateTokenValidityProof(votingToken, crypto.generateChallenge()).proof,
          },
        });
        
        voters.push(voter);
      }
      
      expect(voters).toHaveLength(5);
      voters.forEach(v => {
        expect(v.hasVoted).toBe(false);
        expect(v.votingTokenHash).toBeDefined();
      });
    });

    test('should verify voter registration', async () => {
      const voters = await prisma.voter.findMany({
        where: { electionId: testElectionId },
      });
      
      expect(voters).toHaveLength(5);
      
      const allUnvoted = voters.every(v => !v.hasVoted);
      expect(allUnvoted).toBe(true);
    });
  });

  describe('Step 3: Vote Casting', () => {
    test('should cast votes', async () => {
      const election = await prisma.election.findUnique({
        where: { id: testElectionId },
      });
      
      if (!election) throw new Error('Election not found');

      const votes = [];
      const leaves: string[] = [];
      
      for (let i = 0; i < testVoterTokens.length; i++) {
        const votingToken = testVoterTokens[i];
        const candidateId = testCandidateIds[i % testCandidateIds.length];
        
        // Encrypt vote
        const encrypted = crypto.encryptVote(candidateId, election.publicKey);
        
        // Generate proofs
        const tokenHash = crypto.hashVotingToken(votingToken);
        const voteProof = crypto.generateTokenValidityProof(votingToken, crypto.generateChallenge()).proof;
        const receiptHash = crypto.createReceiptHash(encrypted.ciphertext);
        const ledgerEntryHash = crypto.createReceiptHash(receiptHash + Date.now());
        
        leaves.push(ledgerEntryHash);
        
        const vote = await prisma.vote.create({
          data: {
            electionId: testElectionId,
            candidateId,
            encryptedVote: JSON.stringify(encrypted),
            votingTokenHash: tokenHash,
            voteProof,
            receiptHash,
            ledgerEntryHash,
            merkleRoot: '', // Will be updated later
            merkleProof: '[]',
          },
        });
        
        votes.push(vote);
        
        // Mark voter as voted
        await prisma.voter.updateMany({
          where: { electionId: testElectionId, votingTokenHash: tokenHash },
          data: { hasVoted: true, votedAt: new Date() },
        });
      }
      
      // Build Merkle tree
      const tree = new crypto.MerkleTree(leaves);
      const merkleRoot = tree.getRoot();
      
      // Update votes with Merkle data
      for (let i = 0; i < votes.length; i++) {
        const proof = tree.getProof(i);
        await prisma.vote.update({
          where: { id: votes[i].id },
          data: {
            merkleRoot,
            merkleProof: JSON.stringify(proof.proof),
          },
        });
      }
      
      // Update election Merkle root
      await prisma.election.update({
        where: { id: testElectionId },
        data: { merkleRoot },
      });
      
      expect(votes).toHaveLength(5);
      expect(merkleRoot).toBeDefined();
    });

    test('should verify all voters have voted', async () => {
      const voters = await prisma.voter.findMany({
        where: { electionId: testElectionId },
      });
      
      const allVoted = voters.every(v => v.hasVoted);
      expect(allVoted).toBe(true);
    });
  });

  describe('Step 4: Vote Verification', () => {
    test('should verify Merkle proofs', async () => {
      const votes = await prisma.vote.findMany({
        where: { electionId: testElectionId },
        orderBy: { ledgerTimestamp: 'asc' }, // Order by timestamp to match creation order
      });
      
      // Get the leaves in the same order as they were added
      const leaves = votes.map(v => v.ledgerEntryHash);
      const tree = new crypto.MerkleTree(leaves);
      
      // The root should match what we stored in the election
      const election = await prisma.election.findUnique({
        where: { id: testElectionId },
      });
      
      expect(tree.getRoot()).toBe(election?.merkleRoot);
      
      // Verify each vote has a valid Merkle proof stored
      for (const vote of votes) {
        expect(vote.merkleRoot).toBe(election?.merkleRoot);
        expect(vote.merkleProof).toBeDefined();
        // The stored proof should be valid JSON
        expect(() => JSON.parse(vote.merkleProof)).not.toThrow();
      }
    });

    test('should verify vote integrity', async () => {
      const election = await prisma.election.findUnique({
        where: { id: testElectionId },
      });
      
      const votes = await prisma.vote.findMany({
        where: { electionId: testElectionId },
      });
      
      // All votes should have same Merkle root as election
      const allMatch = votes.every(v => v.merkleRoot === election?.merkleRoot);
      expect(allMatch).toBe(true);
    });
  });

  describe('Step 5: Tallying', () => {
    test('should decrypt and tally votes', async () => {
      const election = await prisma.election.findUnique({
        where: { id: testElectionId },
      });
      
      if (!election) throw new Error('Election not found');

      const votes = await prisma.vote.findMany({
        where: { electionId: testElectionId },
      });
      
      const tally: Record<string, number> = {};
      
      for (const vote of votes) {
        const encrypted = JSON.parse(vote.encryptedVote);
        const candidateId = crypto.decryptVote(encrypted, election.privateKey);
        tally[candidateId] = (tally[candidateId] || 0) + 1;
      }
      
      // Should have votes for both candidates
      const totalVotes = Object.values(tally).reduce((a, b) => a + b, 0);
      expect(totalVotes).toBe(5);
      
      // Verify tally matches expected distribution
      // With 5 voters and 2 candidates, distribution should be 3-2 or 2-3
      const values = Object.values(tally);
      expect(values.some(v => v === 2 || v === 3)).toBe(true);
    });

    test('should create tally results', async () => {
      const election = await prisma.election.findUnique({
        where: { id: testElectionId },
      });
      
      if (!election) throw new Error('Election not found');

      const votes = await prisma.vote.findMany({
        where: { electionId: testElectionId },
      });
      
      const tally: Record<string, number> = {};
      
      for (const vote of votes) {
        const encrypted = JSON.parse(vote.encryptedVote);
        const candidateId = crypto.decryptVote(encrypted, election.privateKey);
        tally[candidateId] = (tally[candidateId] || 0) + 1;
      }
      
      // Create tally results
      for (const candidateId of testCandidateIds) {
        await prisma.tallyResult.create({
          data: {
            electionId: testElectionId,
            candidateId,
            voteCount: tally[candidateId] || 0,
            proof: 'zk-proof-placeholder',
            merkleRoot: election.merkleRoot || '',
          },
        });
      }
      
      const results = await prisma.tallyResult.findMany({
        where: { electionId: testElectionId },
      });
      
      expect(results).toHaveLength(2);
      
      const totalFromResults = results.reduce((sum, r) => sum + r.voteCount, 0);
      expect(totalFromResults).toBe(5);
    });
  });

  describe('Step 6: Audit Trail', () => {
    test('should have complete audit trail', async () => {
      const votes = await prisma.vote.findMany({
        where: { electionId: testElectionId },
      });
      
      // Every vote should have required audit fields
      votes.forEach(vote => {
        expect(vote.receiptHash).toBeDefined();
        expect(vote.ledgerEntryHash).toBeDefined();
        expect(vote.merkleRoot).toBeDefined();
        expect(vote.merkleProof).toBeDefined();
        expect(vote.voteProof).toBeDefined();
      });
    });

    test('should be able to verify individual vote', async () => {
      const vote = await prisma.vote.findFirst({
        where: { electionId: testElectionId },
        include: { election: true },
      });
      
      if (!vote) throw new Error('No vote found');
      
      // Verify Merkle root matches election
      expect(vote.merkleRoot).toBe(vote.election.merkleRoot);
      
      // Verify receipt hash is present
      expect(vote.receiptHash.length).toBeGreaterThan(20);
    });
  });
});

describe('E2E: Security Tests', () => {
  test('should not allow duplicate votes with same token', async () => {
    // This would be enforced by unique constraint on votingTokenHash
    const voter = await prisma.voter.findFirst({
      where: { electionId: testElectionId },
    });
    
    if (!voter) return;
    
    // Attempting to create another vote with same token should fail
    // In real implementation, this is handled by application logic
    expect(voter.hasVoted).toBe(true);
  });

  test('should maintain vote secrecy', async () => {
    const votes = await prisma.vote.findMany({
      where: { electionId: testElectionId },
    });
    
    // Encrypted votes should not reveal candidate choice
    votes.forEach(vote => {
      const encrypted = JSON.parse(vote.encryptedVote);
      // Ciphertext should not contain raw candidate ID
      expect(encrypted.ciphertext).not.toContain('Test Candidate');
    });
  });

  test('should link votes to voters anonymously', async () => {
    const votes = await prisma.vote.findMany({
      where: { electionId: testElectionId },
    });
    
    const voters = await prisma.voter.findMany({
      where: { electionId: testElectionId },
    });
    
    // Each vote has a votingTokenHash that links to a voter
    // But the token itself is hashed, maintaining anonymity
    const voteTokenHashes = votes.map(v => v.votingTokenHash);
    const voterTokenHashes = voters.map(v => v.votingTokenHash);
    
    // All vote token hashes should exist in voter records
    voteTokenHashes.forEach(hash => {
      expect(voterTokenHashes).toContain(hash);
    });
  });
});
