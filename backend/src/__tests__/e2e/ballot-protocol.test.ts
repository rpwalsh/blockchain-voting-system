/**
 * Real, end-to-end, adversarial tests for the ballot submission protocol
 * added in Milestone 1 (backend/src/routes/ballot.ts,
 * backend/src/routes/finalization.ts) and the anonymous eligibility flow
 * added in Milestone 2 (backend/src/routes/eligibility.ts,
 * circuits/eligibility.circom). No mocking - real Postgres, real Groth16
 * proofs, real HTTP requests via supertest against the actual app.
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
  await prisma.nullifier.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.eligibilityCommitment.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
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

// Always created in REGISTRATION so eligibility enrollment (only allowed
// pre-VOTING) can run in setup; callers that need VOTING call openVoting().
async function setupElection() {
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
  const member3 = await prisma.member.create({
    data: { organizationId: orgId, externalId: 'voter-3', isActive: true },
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
      status: 'REGISTRATION',
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
  await prisma.snapshotMember.create({ data: { snapshotId: snapshot.id, memberId: member3.id } });
}

async function openVoting() {
  await prisma.election.update({ where: { id: electionId }, data: { status: 'VOTING' } });
}

async function registerAndGetToken(externalId = 'voter-1') {
  const res = await request(app)
    .post(`/api/elections/${electionId}/voters/register`)
    .send({ externalId });
  return res;
}

// Registers a voter (if not given an existing token) and enrolls a fresh
// eligibility credential for them, authenticated by their token hash.
// Returns the secret needed to later prove membership anonymously.
async function registerAndEnroll(externalId = 'voter-1', votingToken?: string) {
  if (!votingToken) {
    const reg = await registerAndGetToken(externalId);
    if (reg.status !== 201) throw new Error(`registration failed: ${reg.status} ${JSON.stringify(reg.body)}`);
    votingToken = reg.body.votingToken;
  }
  const votingTokenHash = crypto.hashVotingToken(votingToken!);
  const { secret, commitment } = await crypto.generateEligibilityCredential();
  const res = await request(app)
    .post(`/api/elections/${electionId}/eligibility/enroll`)
    .send({ votingTokenHash, commitment });
  return { res, secret, commitment, votingToken: votingToken! };
}

async function buildEligibilityProof(secret: string, commitment: string) {
  const pathRes = await request(app).get(`/api/elections/${electionId}/eligibility/path`).query({ commitment });
  if (pathRes.status !== 200) throw new Error(`path lookup failed: ${pathRes.status} ${JSON.stringify(pathRes.body)}`);
  const { root, pathElements, pathIndices } = pathRes.body;
  return crypto.generateEligibilityProof(secret, electionId, root, pathElements, pathIndices);
}

async function proveAndVote(secret: string, commitment: string, candidateId: string) {
  const eligibilityProof = await buildEligibilityProof(secret, commitment);
  const res = await request(app)
    .post(`/api/elections/${electionId}/vote`)
    .send({ candidateId, eligibilityProof });
  return { res, eligibilityProof };
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
      await setupElection();
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

  describe('eligibility enrollment', () => {
    beforeAll(async () => {
      await cleanup();
      await setupElection();
    }, 30000);

    it('rejects enrollment with an unknown token hash', async () => {
      const { commitment } = await crypto.generateEligibilityCredential();
      const res = await request(app)
        .post(`/api/elections/${electionId}/eligibility/enroll`)
        .send({ votingTokenHash: crypto.hashVotingToken('never-registered'), commitment });
      expect(res.status).toBe(403);
    });

    it('enrolls a registered voter and publishes a new root', async () => {
      const { res } = await registerAndEnroll('voter-1');
      expect(res.status).toBe(201);
      expect(res.body.eligibilityRoot).toBeTruthy();

      const election = await prisma.election.findUnique({ where: { id: electionId } });
      expect(election?.eligibilityRoot).toBe(res.body.eligibilityRoot);
    }, 30000);

    it('rejects enrolling the same commitment twice', async () => {
      const { secret } = await crypto.generateEligibilityCredential();
      const commitment = await crypto.computeEligibilityCommitment(secret);
      const reg = await registerAndGetToken('voter-2');
      const votingTokenHash = crypto.hashVotingToken(reg.body.votingToken);

      const first = await request(app)
        .post(`/api/elections/${electionId}/eligibility/enroll`)
        .send({ votingTokenHash, commitment });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/elections/${electionId}/eligibility/enroll`)
        .send({ votingTokenHash, commitment });
      expect(second.status).toBe(409);
    }, 30000);

    it('rejects enrollment once voting has opened', async () => {
      // registration itself stays open through VOTING (rolling
      // registration); only eligibility enrollment closes once voting
      // opens, since the tree must be stable once proofs are being checked
      // against it.
      const reg = await registerAndGetToken('voter-3');
      expect(reg.status).toBe(201);
      await openVoting();

      const { secret, commitment } = await crypto.generateEligibilityCredential();
      const res = await request(app)
        .post(`/api/elections/${electionId}/eligibility/enroll`)
        .send({ votingTokenHash: crypto.hashVotingToken(reg.body.votingToken), commitment });
      expect(res.status).toBe(409);
      void secret;
    }, 30000);
  });

  describe('real vote casting and protocol attacks', () => {
    let secret: string;
    let commitment: string;
    let secret3: string;
    let commitment3: string;

    beforeAll(async () => {
      await cleanup();
      await setupElection();
      // Enroll everyone this block needs *before* opening voting -
      // enrollment (unlike registration) closes once voting starts.
      const enrolled = await registerAndEnroll('voter-1');
      expect(enrolled.res.status).toBe(201);
      secret = enrolled.secret;
      commitment = enrolled.commitment;

      const enrolled3 = await registerAndEnroll('voter-3');
      expect(enrolled3.res.status).toBe(201);
      secret3 = enrolled3.secret;
      commitment3 = enrolled3.commitment;

      await openVoting();
    }, 30000);

    it('casts a real vote with a real Groth16 eligibility proof', async () => {
      const { res } = await proveAndVote(secret, commitment, candidateAId);
      expect(res.status).toBe(201);
      expect(res.body.receipt.receiptHash).toBeTruthy();
      expect(res.body.receipt.merkleRoot).toBeTruthy();

      const nullifierCount = await prisma.nullifier.count({ where: { electionId } });
      expect(nullifierCount).toBe(1);
    }, 30000);

    it('rejects a second vote from the same credential (nullifier reuse)', async () => {
      const { res } = await proveAndVote(secret, commitment, candidateBId);
      expect(res.status).toBe(409);
    }, 30000);

    it('rejects a proof built against a stale eligibility root', async () => {
      // Simulate the root having moved on since this proof was built (e.g.
      // a revocation) - a proof valid against an old root must not verify
      // against the current one.
      const eligibilityProof = await buildEligibilityProof(secret, commitment);
      const realRoot = eligibilityProof.publicInputs[1];
      await prisma.election.update({ where: { id: electionId }, data: { eligibilityRoot: 'attacker-cannot-just-change-this-and-have-old-proofs-match' } });
      const res = await request(app)
        .post(`/api/elections/${electionId}/vote`)
        .send({ candidateId: candidateAId, eligibilityProof });
      expect(res.status).toBe(403);

      await prisma.election.update({ where: { id: electionId }, data: { eligibilityRoot: realRoot } });
    }, 30000);

    it('rejects a proof for a credential that was never enrolled', async () => {
      const { secret: strangerSecret } = await crypto.generateEligibilityCredential();
      const election = await prisma.election.findUnique({ where: { id: electionId } });
      // Build a proof using a path for a *different*, real, enrolled leaf,
      // but swap in the stranger's own secret - the leaf hash in the proof
      // won't match what the path was issued for, so the Merkle constraint
      // in the circuit itself must fail to produce a valid proof/witness.
      const pathRes = await request(app).get(`/api/elections/${electionId}/eligibility/path`).query({ commitment });
      await expect(
        crypto.generateEligibilityProof(strangerSecret, electionId, election!.eligibilityRoot!, pathRes.body.pathElements, pathRes.body.pathIndices)
      ).rejects.toBeTruthy();
    }, 30000);

    it('rejects a candidateId that does not belong to this election', async () => {
      const eligibilityProof = await buildEligibilityProof(secret3, commitment3);
      const res = await request(app)
        .post(`/api/elections/${electionId}/vote`)
        .send({ candidateId: 'not-a-real-candidate-id', eligibilityProof });
      expect(res.status).toBe(400);
    }, 30000);
  });

  describe('voting outside the open window', () => {
    beforeAll(async () => {
      await cleanup();
      await setupElection();
    });

    it('rejects a vote when the election is not in VOTING status', async () => {
      const enrolled = await registerAndEnroll('voter-1');
      expect(enrolled.res.status).toBe(201);
      // election is still REGISTRATION, never opened to VOTING
      const eligibilityProof = await buildEligibilityProof(enrolled.secret, enrolled.commitment);
      const res = await request(app)
        .post(`/api/elections/${electionId}/vote`)
        .send({ candidateId: candidateAId, eligibilityProof });
      expect(res.status).toBe(409);
    }, 30000);
  });

  describe('finalization', () => {
    beforeAll(async () => {
      await cleanup();
      await setupElection();
      const enrolled = await registerAndEnroll('voter-1');
      await openVoting();
      await proveAndVote(enrolled.secret, enrolled.commitment, candidateAId);
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
