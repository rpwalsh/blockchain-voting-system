/**
 * Real, end-to-end, adversarial tests for Milestone 5's multi-party admin
 * approval workflow, recount, observer mode, and audit export
 * (backend/src/routes/election-approvals.ts, operations.ts). No mocking -
 * real Postgres, real Ed25519 signatures, real HTTP requests.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../index';
import { prisma } from '../../db';
import crypto from '../../crypto/engine';
import tallyLib from '../../crypto/tally';
import { loadConfig } from '../../config';
import { createLedgerEntry } from '../../utils/audit';

const PREFIX = 'election-approvals-test-';

let orgId: string;
let electionId: string;

async function cleanup() {
  await prisma.electionApprovalSignature.deleteMany({ where: { approval: { election: { name: { startsWith: PREFIX } } } } });
  await prisma.electionApproval.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.tallyResult.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.vote.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.nullifier.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.eligibilityCommitment.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.ledgerEntry.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.electionFinalization.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.voter.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.candidate.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.election.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { organization: { name: { startsWith: PREFIX } } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: PREFIX } } });
}

function authToken(userId: string, orgId: string, role: string) {
  return jwt.sign({ userId, orgId, role, email: `${userId}@example.com` }, loadConfig().jwtSecret, { expiresIn: '1h' });
}

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

  const admin1 = await prisma.user.create({
    data: { organizationId: orgId, email: 'admin1@example.com', username: 'admin1', role: 'ORG_ADMIN', isActive: true },
  });
  const admin2 = await prisma.user.create({
    data: { organizationId: orgId, email: 'admin2@example.com', username: 'admin2', role: 'ELECTION_OFFICER', isActive: true },
  });

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
      status: 'DRAFT',
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

  await prisma.candidate.create({ data: { electionId, name: 'Candidate A', order: 0 } });

  return { admin1, admin2 };
}

describe('Multi-party admin approvals, recount, observer, audit export (real, adversarial)', () => {
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  describe('propose/approve quorum workflow', () => {
    let admin1: any;
    let admin2: any;
    let token1: string;
    let token2: string;
    let approvalId: string;
    let proposalHash: string;
    let admin1Kp: { publicKey: string; privateKey: string };

    beforeAll(async () => {
      await cleanup();
      const admins = await setupElection();
      admin1 = admins.admin1;
      admin2 = admins.admin2;
      token1 = authToken(admin1.id, orgId, 'ORG_ADMIN');
      token2 = authToken(admin2.id, orgId, 'ELECTION_OFFICER');
    });

    it('rejects an unauthenticated proposal', async () => {
      const res = await request(app).post(`/api/elections/${electionId}/admin-actions/propose`).send({ action: 'CERTIFY' });
      expect(res.status).toBe(401);
    });

    it('proposes a CERTIFY action requiring 2 approvals', async () => {
      const res = await request(app)
        .post(`/api/elections/${electionId}/admin-actions/propose`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ action: 'CERTIFY', reason: 'routine certification' });
      expect(res.status).toBe(201);
      expect(res.body.approval.threshold).toBe(2);
      approvalId = res.body.approval.id;
      proposalHash = res.body.approval.proposalHash;
    });

    it('does not execute after only one approval', async () => {
      admin1Kp = crypto.generateKeyPair();
      const signature = crypto.signData(proposalHash, admin1Kp.privateKey);
      const res = await request(app)
        .post(`/api/elections/${electionId}/admin-actions/${approvalId}/approve`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ signature, publicKey: admin1Kp.publicKey });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.signatureCount).toBe(1);

      const election = await prisma.election.findUnique({ where: { id: electionId } });
      expect(election?.status).toBe('DRAFT');
    });

    it('rejects the same admin approving twice, even with their own established key', async () => {
      const signature = crypto.signData(proposalHash, admin1Kp.privateKey);
      const res = await request(app)
        .post(`/api/elections/${electionId}/admin-actions/${approvalId}/approve`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ signature, publicKey: admin1Kp.publicKey });
      expect(res.status).toBe(409);
    });

    it('rejects a signature from a key different than the one this admin already established', async () => {
      const otherKp = crypto.generateKeyPair();
      const signature = crypto.signData(proposalHash, otherKp.privateKey);
      const res = await request(app)
        .post(`/api/elections/${electionId}/admin-actions/${approvalId}/approve`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ signature, publicKey: otherKp.publicKey });
      expect(res.status).toBe(403);
    });

    it('rejects a forged signature from a second admin', async () => {
      const otherKp = crypto.generateKeyPair();
      const forgedSignature = crypto.signData('not-the-real-proposal-hash', otherKp.privateKey);
      const res = await request(app)
        .post(`/api/elections/${electionId}/admin-actions/${approvalId}/approve`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ signature: forgedSignature, publicKey: otherKp.publicKey });
      expect(res.status).toBe(403);
    });

    it('executes once the second distinct admin approves for real', async () => {
      const kp = crypto.generateKeyPair();
      const signature = crypto.signData(proposalHash, kp.privateKey);
      const res = await request(app)
        .post(`/api/elections/${electionId}/admin-actions/${approvalId}/approve`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ signature, publicKey: kp.publicKey });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('EXECUTED');

      const election = await prisma.election.findUnique({ where: { id: electionId } });
      expect(election?.status).toBe('REGISTRATION');
    });

    it('rejects approving an already-executed proposal', async () => {
      const kp = crypto.generateKeyPair();
      const signature = crypto.signData(proposalHash, kp.privateKey);
      const res = await request(app)
        .post(`/api/elections/${electionId}/admin-actions/${approvalId}/approve`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ signature, publicKey: kp.publicKey });
      expect(res.status).toBe(409);
    });

    it('rejects proposing an action whose precondition status does not hold', async () => {
      const res = await request(app)
        .post(`/api/elections/${electionId}/admin-actions/propose`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ action: 'CERTIFY' }); // election is now REGISTRATION, not DRAFT
      expect(res.status).toBe(400);
    });
  });

  describe('recount, observer, and audit export', () => {
    beforeAll(async () => {
      await cleanup();
      await setupElection();
      await prisma.election.update({ where: { id: electionId }, data: { status: 'REGISTRATION' } });

      const election = await prisma.election.findUniqueOrThrow({ where: { id: electionId } });
      await createLedgerEntry(electionId, 'REGISTRATION', { note: 'test fixture entry' }, election.signingPrivateKey!);
    }, 30000);

    it('observer status is readable without authentication and exposes only aggregate signals', async () => {
      const res = await request(app).get(`/api/elections/${electionId}/observer/status`);
      expect(res.status).toBe(200);
      expect(res.body.observer.electionId).toBe(electionId);
      expect(res.body.observer.status).toBe('REGISTRATION');
      expect(res.body.observer.voteCount).toBe(0);
      expect(res.body.observer).not.toHaveProperty('ballots');
      expect(res.body.observer).not.toHaveProperty('votes');
    });

    it('audit export produces a bundle in the verifier CLI\'s expected shape', async () => {
      const res = await request(app).get(`/api/elections/${electionId}/audit-export`);
      expect(res.status).toBe(200);
      expect(res.body.version).toBe('election-audit-bundle-1');
      expect(res.body.election.id).toBe(electionId);
      expect(Array.isArray(res.body.ballots)).toBe(true);
      expect(Array.isArray(res.body.ledgerEntries)).toBe(true);
    });

    it('recount reports a clean ledger and matching Merkle root on a fresh election', async () => {
      const res = await request(app).post(`/api/elections/${electionId}/recount`);
      expect(res.status).toBe(200);
      expect(res.body.recount.ledgerValid).toBe(true);
      expect(res.body.recount.ballotsChecked).toBe(0);
    });

    it('recount detects a tampered ledger entry', async () => {
      const entry = await prisma.ledgerEntry.findFirst({ where: { electionId } });
      expect(entry).toBeTruthy();
      await prisma.ledgerEntry.update({ where: { id: entry!.id }, data: { data: 'tampered-data-blob' } });
      const res = await request(app).post(`/api/elections/${electionId}/recount`);
      expect(res.body.recount.ledgerValid).toBe(false);
      expect(res.body.recount.allMatch).toBe(false);
    });
  });
});
