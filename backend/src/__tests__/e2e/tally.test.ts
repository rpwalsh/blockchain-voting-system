/**
 * Real, end-to-end, adversarial tests for the cryptographic tally
 * (Milestone 3) - backend/src/routes/tally.ts, backend/src/crypto/tally.ts.
 * No mocking - real Postgres, real EC ElGamal ciphertexts, real HTTP
 * requests via supertest against the actual app.
 */

import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../db';
import crypto from '../../crypto/engine';
import tallyLib from '../../crypto/tally';

const PREFIX = 'tally-test-';

let orgId: string;
let electionId: string;
let candidateAId: string;
let candidateBId: string;
let candidateCId: string;

async function cleanup() {
  await prisma.tallyResult.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.vote.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.nullifier.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.eligibilityCommitment.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.ledgerEntry.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.voter.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.snapshotMember.deleteMany({ where: { snapshot: { election: { name: { startsWith: PREFIX } } } } });
  await prisma.electorateSnapshot.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.candidate.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.election.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.member.deleteMany({ where: { organization: { name: { startsWith: PREFIX } } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: PREFIX } } });
}

async function setupElection(voterCount: number) {
  const org = await prisma.organization.create({
    data: {
      name: `${PREFIX}org-${Date.now()}-${Math.random()}`,
      slug: `${PREFIX}org-${Date.now()}-${Math.random()}`,
      type: 'PROJECT',
      primaryContact: 'test',
      email: 'test@example.com',
      publicKey: crypto.generateKeyPair().publicKey,
      apiKey: crypto.generateVotingToken(),
    },
  });
  orgId = org.id;

  const members = await Promise.all(
    Array.from({ length: voterCount }, (_, i) =>
      prisma.member.create({ data: { organizationId: orgId, externalId: `voter-${i}`, isActive: true } })
    )
  );

  const electionKeyPair = crypto.generateElectionKeyPair();
  const signingKeyPair = crypto.generateKeyPair();
  const keyShares = crypto.splitSecretShamir(electionKeyPair.privateKey, 3, 5);
  const tallyKeyPair = tallyLib.generateTallyKeyPair();
  const tallyShares = tallyLib.splitScalarShamir(tallyKeyPair.privateKey, 3, 5);

  const election = await prisma.election.create({
    data: {
      organizationId: orgId,
      name: `${PREFIX}election-${Date.now()}`,
      type: 'PROJECT',
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
      status: 'REGISTRATION',
      publicKey: electionKeyPair.publicKey,
      privateKeyHash: crypto.hashVotingToken(electionKeyPair.privateKey),
      privateKey: electionKeyPair.privateKey,
      keyShares: JSON.stringify(keyShares),
      signingPublicKey: signingKeyPair.publicKey,
      signingPrivateKey: signingKeyPair.privateKey,
      tallyPublicKey: JSON.stringify(tallyKeyPair.publicKey),
      tallyKeyShares: JSON.stringify(tallyShares),
      tallyThreshold: 3,
    },
  });
  electionId = election.id;

  const [candA, candB, candC] = await Promise.all([
    prisma.candidate.create({ data: { electionId, name: 'Candidate A', order: 0 } }),
    prisma.candidate.create({ data: { electionId, name: 'Candidate B', order: 1 } }),
    prisma.candidate.create({ data: { electionId, name: 'Candidate C', order: 2 } }),
  ]);
  candidateAId = candA.id;
  candidateBId = candB.id;
  candidateCId = candC.id;

  const snapshot = await prisma.electorateSnapshot.create({
    data: { organizationId: orgId, electionId, snapshotHash: 'test-snapshot-hash', memberCount: members.length, reportJson: '{}' },
  });
  await Promise.all(members.map(m => prisma.snapshotMember.create({ data: { snapshotId: snapshot.id, memberId: m.id } })));
}

async function registerAndEnroll(externalId: string) {
  const reg = await request(app).post(`/api/elections/${electionId}/voters/register`).send({ externalId });
  if (reg.status !== 201) throw new Error(`registration failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  const votingTokenHash = crypto.hashVotingToken(reg.body.votingToken);
  const { secret, commitment } = await crypto.generateEligibilityCredential();
  const enroll = await request(app).post(`/api/elections/${electionId}/eligibility/enroll`).send({ votingTokenHash, commitment });
  if (enroll.status !== 201) throw new Error(`enroll failed: ${enroll.status} ${JSON.stringify(enroll.body)}`);
  return { secret, commitment };
}

async function castVote(secret: string, commitment: string, candidateId: string) {
  const pathRes = await request(app).get(`/api/elections/${electionId}/eligibility/path`).query({ commitment });
  const eligibilityProof = await crypto.generateEligibilityProof(secret, electionId, pathRes.body.root, pathRes.body.pathElements, pathRes.body.pathIndices);
  const res = await request(app).post(`/api/elections/${electionId}/vote`).send({ candidateId, eligibilityProof });
  if (res.status !== 201) throw new Error(`vote failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res;
}

describe('Cryptographic tally (real, adversarial)', () => {
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  describe('compute and verify', () => {
    beforeAll(async () => {
      await cleanup();
      await setupElection(5);
      const voters = await Promise.all([0, 1, 2, 3, 4].map(i => registerAndEnroll(`voter-${i}`)));
      await prisma.election.update({ where: { id: electionId }, data: { status: 'VOTING' } });

      // A=2, B=1, C=2
      await castVote(voters[0].secret, voters[0].commitment, candidateAId);
      await castVote(voters[1].secret, voters[1].commitment, candidateAId);
      await castVote(voters[2].secret, voters[2].commitment, candidateBId);
      await castVote(voters[3].secret, voters[3].commitment, candidateCId);
      await castVote(voters[4].secret, voters[4].commitment, candidateCId);
    }, 120000);

    it('every cast ballot carries a real homomorphic ciphertext, not a plaintext choice', async () => {
      const votes = await prisma.vote.findMany({ where: { electionId } });
      expect(votes).toHaveLength(5);
      for (const v of votes) {
        expect(v.tallyCiphertexts).toBeTruthy();
        const parsed = JSON.parse(v.tallyCiphertexts!);
        expect(parsed).toHaveLength(3);
      }
    });

    it('computes the correct real tally via threshold decryption', async () => {
      const res = await request(app).post(`/api/elections/${electionId}/tally/compute`);
      expect(res.status).toBe(201);
      expect(res.body.totalBallots).toBe(5);

      const byCandidate = Object.fromEntries(res.body.results.map((r: any) => [r.candidateId, r.voteCount]));
      expect(byCandidate[candidateAId]).toBe(2);
      expect(byCandidate[candidateBId]).toBe(1);
      expect(byCandidate[candidateCId]).toBe(2);
    }, 30000);

    it('is idempotent - a second compute call does not re-tally', async () => {
      const res = await request(app).post(`/api/elections/${electionId}/tally/compute`);
      expect(res.status).toBe(200);
      expect(res.body.alreadyTallied).toBe(true);
    });

    it('independently re-verifies the certified tally from scratch', async () => {
      const res = await request(app).get(`/api/elections/${electionId}/tally/verify`);
      expect(res.status).toBe(200);
      expect(res.body.allVerified).toBe(true);
      for (const r of res.body.results) {
        expect(r.checks.ciphertextSumMatches).toBe(true);
        expect(r.checks.partialDecryptionProofsValid).toBe(true);
        expect(r.checks.decryptedCountMatches).toBe(true);
      }
    });

    it('detects a tampered partial decryption on re-verification', async () => {
      const stored = await prisma.tallyResult.findFirst({ where: { electionId, candidateId: candidateAId } });
      expect(stored).toBeTruthy();
      const bundle = JSON.parse(stored!.proof);
      bundle.partialDecryptions[0].point = { x: '1', y: '2' };
      await prisma.tallyResult.update({ where: { id: stored!.id }, data: { proof: JSON.stringify(bundle) } });

      const res = await request(app).get(`/api/elections/${electionId}/tally/verify`);
      const tampered = res.body.results.find((r: any) => r.candidateId === candidateAId);
      expect(tampered.verified).toBe(false);
      expect(tampered.checks.partialDecryptionProofsValid).toBe(false);
    });
  });

  describe('refuses to tally with no ballots', () => {
    beforeAll(async () => {
      await cleanup();
      await setupElection(1);
      await prisma.election.update({ where: { id: electionId }, data: { status: 'VOTING' } });
    });

    it('rejects tally computation before any vote is cast', async () => {
      const res = await request(app).post(`/api/elections/${electionId}/tally/compute`);
      expect(res.status).toBe(409);
    });
  });
});
