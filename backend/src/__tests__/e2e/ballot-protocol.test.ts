/**
 * Real, end-to-end, adversarial tests for the ballot submission protocol
 * added in Milestone 1 (backend/src/routes/ballot.ts,
 * backend/src/routes/finalization.ts). No mocking - real Postgres, real
 * Groth16 proofs, real HTTP requests via supertest against the actual app.
 *
 * Per docs/protocol.md and the project's "attack the protocol, not merely
 * the functions" testing goal: every adversarial case here must produce a
 * rejection, not a 200.
 */

import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../db';
import crypto from '../../crypto/engine';

const PREFIX = 'ballot-protocol-test-';

let orgId: string;
let electionId: string;
let candidateAId: string;
let candidateBId: string;

async function cleanup() {
  await prisma.vote.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.challengeNonce.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.electionFinalization.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.ledgerEntry.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.voter.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.snapshotMember.deleteMany({ where: { snapshot: { election: { name: { startsWith: PREFIX } } } } });
  await prisma.electorateSnapshot.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.candidate.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.election.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.member.deleteMany({ where: { organization: { name: { startsWith: PREFIX } } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: PREFIX } } });
}

async function setupElection(status: string) {
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

  const member = await prisma.member.create({
    data: { organizationId: orgId, externalId: 'voter-1', isActive: true },
  });
  const member2 = await prisma.member.create({
    data: { organizationId: orgId, externalId: 'voter-2', isActive: true },
  });

  const electionKeyPair = crypto.generateElectionKeyPair();
  const signingKeyPair = crypto.generateKeyPair();
  const keyShares = crypto.splitSecretShamir(electionKeyPair.privateKey, 3, 5);

  const election = await prisma.election.create({
    data: {
      organizationId: orgId,
      name: `${PREFIX}election-${Date.now()}`,
      type: 'PROJECT',
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
      status,
      publicKey: electionKeyPair.publicKey,
      privateKeyHash: crypto.hashVotingToken(electionKeyPair.privateKey),
      privateKey: electionKeyPair.privateKey,
      keyShares: JSON.stringify(keyShares),
      signingPublicKey: signingKeyPair.publicKey,
      signingPrivateKey: signingKeyPair.privateKey,
    },
  });
  electionId = election.id;

  const [candA, candB] = await Promise.all([
    prisma.candidate.create({ data: { electionId, name: 'Candidate A' } }),
    prisma.candidate.create({ data: { electionId, name: 'Candidate B' } }),
  ]);
  candidateAId = candA.id;
  candidateBId = candB.id;

  const snapshot = await prisma.electorateSnapshot.create({
    data: {
      organizationId: orgId,
      electionId,
      snapshotHash: 'test-snapshot-hash',
      memberCount: 1,
      reportJson: '{}',
    },
  });
  await prisma.snapshotMember.create({ data: { snapshotId: snapshot.id, memberId: member.id } });
  await prisma.snapshotMember.create({ data: { snapshotId: snapshot.id, memberId: member2.id } });
}

async function registerAndGetToken(externalId = 'voter-1') {
  const res = await request(app)
    .post(`/api/elections/${electionId}/voters/register`)
    .send({ externalId });
  return res;
}

async function getChallenge() {
  const res = await request(app).get(`/api/elections/${electionId}/challenge`);
  return res.body.challenge as string;
}

async function proveAndVote(votingToken: string, candidateId: string) {
  const challenge = await getChallenge();
  const commitment = await crypto.computeTokenCommitment(votingToken);
  const proof = await crypto.generateTokenValidityProof(votingToken, challenge);
  const res = await request(app)
    .post(`/api/elections/${electionId}/vote`)
    .send({ votingToken, candidateId, challenge, tokenValidityProof: proof });
  return { res, challenge, commitment, proof };
}

describe('Ballot protocol (real, adversarial)', () => {
  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  describe('registration', () => {
    beforeAll(async () => {
      await setupElection('VOTING');
    });

    it('rejects registration for someone not in the electorate snapshot', async () => {
      const res = await registerAndGetToken('not-a-real-member');
      expect(res.status).toBe(403);
    });

    it('registers an eligible member and returns a usable token', async () => {
      const res = await registerAndGetToken('voter-1');
      expect(res.status).toBe(201);
      expect(typeof res.body.votingToken).toBe('string');

      const voter = await prisma.voter.findFirst({ where: { electionId } });
      expect(voter?.tokenCommitment).toBeTruthy();
    });

    it('rejects a second registration for the same member', async () => {
      const res = await registerAndGetToken('voter-1');
      expect(res.status).toBe(409);
    });
  });

  describe('real vote casting and protocol attacks', () => {
    let votingToken: string;

    beforeAll(async () => {
      await cleanup();
      await setupElection('VOTING');
      const reg = await registerAndGetToken('voter-1');
      votingToken = reg.body.votingToken;
    }, 30000);

    it('casts a real vote with a real Groth16 proof', async () => {
      const { res } = await proveAndVote(votingToken, candidateAId);
      expect(res.status).toBe(201);
      expect(res.body.receipt.receiptHash).toBeTruthy();
      expect(res.body.receipt.merkleRoot).toBeTruthy();

      const voter = await prisma.voter.findFirst({ where: { electionId } });
      expect(voter?.hasVoted).toBe(true);
    }, 30000);

    it('rejects a second vote from the same credential (double-vote)', async () => {
      const { res } = await proveAndVote(votingToken, candidateBId);
      expect(res.status).toBe(409);
    }, 30000);

    it('rejects reusing an already-consumed challenge', async () => {
      const challenge = await getChallenge();
      const proof = await crypto.generateTokenValidityProof(votingToken, challenge);

      // Consume it once via a vote attempt (will fail on double-vote, but
      // that happens *after* challenge consumption in the route, so the
      // challenge itself is burned either way for this test's purpose -
      // instead, directly mark it consumed to isolate the challenge-reuse
      // check from the double-vote check.)
      await prisma.challengeNonce.update({ where: { challenge }, data: { consumedAt: new Date() } });

      const res = await request(app)
        .post(`/api/elections/${electionId}/vote`)
        .send({ votingToken, candidateId: candidateAId, challenge, tokenValidityProof: proof });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already used/i);
    }, 30000);

    it('rejects an unknown challenge never issued by the server', async () => {
      const fakeChallenge = crypto.generateChallenge();
      const proof = await crypto.generateTokenValidityProof(votingToken, fakeChallenge);
      const res = await request(app)
        .post(`/api/elections/${electionId}/vote`)
        .send({ votingToken, candidateId: candidateAId, challenge: fakeChallenge, tokenValidityProof: proof });
      expect(res.status).toBe(400);
    }, 30000);

    it('rejects a proof generated for a different token than the one submitted', async () => {
      // Uses a second, still-unspent registered voter (voter-2) rather than
      // the shared `votingToken` from beforeAll, which already voted in an
      // earlier test in this block - reusing it here would hit the
      // already-voted check before proof verification even runs, testing
      // the wrong thing.
      const reg2 = await registerAndGetToken('voter-2');
      expect(reg2.status).toBe(201);
      const votingToken2 = reg2.body.votingToken;

      const challenge = await getChallenge();
      const otherToken = crypto.generateVotingToken();
      const wrongProof = await crypto.generateTokenValidityProof(otherToken, challenge);
      const res = await request(app)
        .post(`/api/elections/${electionId}/vote`)
        .send({ votingToken: votingToken2, candidateId: candidateAId, challenge, tokenValidityProof: wrongProof });
      expect(res.status).toBe(403);
    }, 30000);

    it('rejects an unregistered/unknown voting token', async () => {
      const challenge = await getChallenge();
      const unknownToken = crypto.generateVotingToken();
      const proof = await crypto.generateTokenValidityProof(unknownToken, challenge);
      const res = await request(app)
        .post(`/api/elections/${electionId}/vote`)
        .send({ votingToken: unknownToken, candidateId: candidateAId, challenge, tokenValidityProof: proof });
      expect(res.status).toBe(403);
    }, 30000);

    it('rejects a candidateId that does not belong to this election', async () => {
      const challenge = await getChallenge();
      const proof = await crypto.generateTokenValidityProof(votingToken, challenge);
      const res = await request(app)
        .post(`/api/elections/${electionId}/vote`)
        .send({ votingToken, candidateId: 'not-a-real-candidate-id', challenge, tokenValidityProof: proof });
      expect(res.status).toBe(400);
    }, 30000);
  });

  describe('voting outside the open window', () => {
    beforeAll(async () => {
      await cleanup();
      await setupElection('DRAFT');
    });

    it('rejects a vote when the election is not in VOTING status', async () => {
      const reg = await registerAndGetToken('voter-1');
      // registration itself is allowed pre-open (DRAFT), but voting is not
      expect(reg.status).toBe(201);
      const challenge = await getChallenge();
      const proof = await crypto.generateTokenValidityProof(reg.body.votingToken, challenge);
      const res = await request(app)
        .post(`/api/elections/${electionId}/vote`)
        .send({ votingToken: reg.body.votingToken, candidateId: candidateAId, challenge, tokenValidityProof: proof });
      expect(res.status).toBe(409);
    }, 30000);
  });

  describe('finalization', () => {
    let votingToken: string;

    beforeAll(async () => {
      await cleanup();
      await setupElection('VOTING');
      const reg = await registerAndGetToken('voter-1');
      votingToken = reg.body.votingToken;
      await proveAndVote(votingToken, candidateAId);
    }, 30000);

    it('produces a signed manifest that verifies', async () => {
      const res = await request(app).post(`/api/elections/${electionId}/finalize`);
      expect(res.status).toBe(201);
      expect(res.body.finalization.manifestHash).toBeTruthy();

      const verify = await request(app).get(`/api/elections/${electionId}/finalization`);
      expect(verify.status).toBe(200);
      expect(verify.body.verified.manifestHashMatches).toBe(true);
      expect(verify.body.verified.signatureValid).toBe(true);
    }, 30000);

    it('is idempotent - a second finalize call does not produce a different manifest', async () => {
      const first = await prisma.electionFinalization.findUnique({ where: { electionId } });
      const res = await request(app).post(`/api/elections/${electionId}/finalize`);
      expect(res.status).toBe(200);
      expect(res.body.alreadyFinalized).toBe(true);
      expect(res.body.finalization.manifestHash).toBe(first?.manifestHash);
    }, 30000);

    it('detects a tampered manifest (signature no longer verifies)', async () => {
      const finalization = await prisma.electionFinalization.findUnique({ where: { electionId } });
      expect(finalization).toBeTruthy();

      // Simulate a compromised database directly rewriting the "final" root
      // - exactly the attack docs/threat-model.md's "compromised server"
      // row describes. The signature must catch this.
      await prisma.electionFinalization.update({
        where: { electionId },
        data: { finalBallotRoot: 'attacker-controlled-fake-root' },
      });

      const verify = await request(app).get(`/api/elections/${electionId}/finalization`);
      expect(verify.body.verified.manifestHashMatches).toBe(false);
      expect(verify.body.verified.signatureValid).toBe(false);
    }, 30000);
  });
});
