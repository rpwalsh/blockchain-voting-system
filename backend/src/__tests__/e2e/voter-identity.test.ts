/**
 * Real, adversarial tests for OIDC-based voter identity verification
 * (routes/voter-identity.ts) and its gating effect on registration
 * (routes/ballot.ts). Real Postgres, real Ed25519/token crypto, real
 * cookie/state handling - only the external IdP network call
 * (openid-client's Issuer.discover/client.callback) is mocked, since
 * there is no real ID.me/Login.gov test account to hit from CI. This
 * tests that our OIDC orchestration is correct, not that a third-party
 * server is reachable.
 */

import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../db';
import crypto from '../../crypto/engine';

const PREFIX = 'voter-identity-test-';

let mockCallback: jest.Mock;

jest.mock('openid-client', () => {
  const actual = jest.requireActual('openid-client');
  return {
    ...actual,
    Issuer: {
      discover: jest.fn().mockImplementation(async () => ({
        Client: class {
          authorizationUrl(params: any) {
            return `https://mock-idp.example/authorize?state=${params.state}`;
          }
          callbackParams(req: any) {
            return req.query;
          }
          async callback(...args: any[]) {
            return (global as any).__mockOidcCallback(...args);
          }
        },
      })),
    },
  };
});

let orgId: string;
let electionId: string;
let providerId: string;

async function cleanup() {
  await prisma.voterIdentityVerification.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.voter.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.ledgerEntry.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.electorateSnapshot.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.candidate.deleteMany({ where: { election: { name: { startsWith: PREFIX } } } });
  await prisma.election.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.organizationAuthProvider.deleteMany({ where: { organization: { name: { startsWith: PREFIX } } } });
  await prisma.member.deleteMany({ where: { organization: { name: { startsWith: PREFIX } } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: PREFIX } } });
}

async function setupElection() {
  const org = await prisma.organization.create({
    data: {
      name: `${PREFIX}org-${Date.now()}-${Math.random()}`,
      slug: `${PREFIX}org-${Date.now()}-${Math.random()}`,
      type: 'MUNICIPAL',
      primaryContact: 'test',
      email: 'test@example.com',
      publicKey: crypto.generateKeyPair().publicKey,
      apiKey: crypto.generateVotingToken(),
    },
  });
  orgId = org.id;

  const provider = await prisma.organizationAuthProvider.create({
    data: {
      organizationId: orgId,
      type: 'OIDC',
      purpose: 'VOTER_IDENTITY_VERIFICATION',
      name: 'id.me',
      issuerUrl: 'https://mock-idp.example',
      clientId: 'test-client',
      clientSecret: 'test-secret',
      redirectUri: 'https://app.example/callback',
      enabled: true,
    },
  });
  providerId = provider.id;

  const member = await prisma.member.create({
    data: { organizationId: orgId, externalId: 'voter-1', isActive: true },
  });

  const electionKeyPair = crypto.generateElectionKeyPair();
  const signingKeyPair = crypto.generateKeyPair();
  const election = await prisma.election.create({
    data: {
      organizationId: orgId,
      name: `${PREFIX}election-${Date.now()}`,
      type: 'MUNICIPAL',
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
      status: 'REGISTRATION',
      publicKey: electionKeyPair.publicKey,
      privateKeyHash: crypto.hashVotingToken(electionKeyPair.privateKey),
      privateKey: electionKeyPair.privateKey,
      signingPublicKey: signingKeyPair.publicKey,
      signingPrivateKey: signingKeyPair.privateKey,
    },
  });
  electionId = election.id;

  const snapshot = await prisma.electorateSnapshot.create({
    data: { organizationId: orgId, electionId, snapshotHash: 'test', memberCount: 1, reportJson: '{}' },
  });
  await prisma.snapshotMember.create({ data: { snapshotId: snapshot.id, memberId: member.id } });
}

describe('Voter identity verification (real, adversarial)', () => {
  beforeAll(async () => {
    await cleanup();
    await setupElection();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('rejects registration for a real electorate member without identity verification', async () => {
    const res = await request(app).post(`/api/elections/${electionId}/voters/register`).send({ externalId: 'voter-1' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/identity verification/i);
  });

  it('rejects a verification start request with no externalId', async () => {
    const res = await request(app).get(`/api/elections/${electionId}/voters/verify-identity/start`);
    expect(res.status).toBe(400);
  });

  it('redirects to the configured provider with real PKCE state, and sets a signed state cookie', async () => {
    const res = await request(app)
      .get(`/api/elections/${electionId}/voters/verify-identity/start`)
      .query({ externalId: 'voter-1' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('mock-idp.example/authorize');
    const setCookie = [res.headers['set-cookie']].flat().filter(Boolean) as string[];
    expect(setCookie.some(c => c.startsWith('voter_identity_oidc'))).toBe(true);
  });

  it('completes verification and then allows registration, consuming the verification', async () => {
    (global as any).__mockOidcCallback = jest.fn().mockResolvedValue({ claims: () => ({ sub: 'real-person-abc123' }) });

    const startRes = await request(app)
      .get(`/api/elections/${electionId}/voters/verify-identity/start`)
      .query({ externalId: 'voter-1' });
    const cookies = startRes.headers['set-cookie'];
    const stateMatch = startRes.headers.location.match(/state=([^&]+)/);
    const state = stateMatch![1];

    const callbackRes = await request(app)
      .get(`/api/elections/${electionId}/voters/verify-identity/callback`)
      .set('Cookie', cookies)
      .query({ state, code: 'mock-auth-code' });
    expect(callbackRes.status).toBe(200);
    expect(callbackRes.body.verified).toBe(true);

    const registerRes = await request(app).post(`/api/elections/${electionId}/voters/register`).send({ externalId: 'voter-1' });
    expect(registerRes.status).toBe(201);

    const verification = await prisma.voterIdentityVerification.findFirst({ where: { electionId, externalId: 'voter-1' } });
    expect(verification?.consumedAt).toBeTruthy();
  });

  it('rejects a second registration reusing the already-consumed verification', async () => {
    const res = await request(app).post(`/api/elections/${electionId}/voters/register`).send({ externalId: 'voter-1' });
    // Already registered wins first (identityHash uniqueness), but either
    // way this must not succeed a second time.
    expect(res.status).not.toBe(201);
  });

  it('rejects a callback with a state that does not match the cookie', async () => {
    const startRes = await request(app)
      .get(`/api/elections/${electionId}/voters/verify-identity/start`)
      .query({ externalId: 'voter-2' });
    const cookies = startRes.headers['set-cookie'];

    const res = await request(app)
      .get(`/api/elections/${electionId}/voters/verify-identity/callback`)
      .set('Cookie', cookies)
      .query({ state: 'forged-state-value', code: 'mock-auth-code' });
    expect(res.status).toBe(400);
  });

  it('rejects a second verified externalId claim from the same real-world subject', async () => {
    (global as any).__mockOidcCallback = jest.fn().mockResolvedValue({ claims: () => ({ sub: 'real-person-abc123' }) });

    const startRes = await request(app)
      .get(`/api/elections/${electionId}/voters/verify-identity/start`)
      .query({ externalId: 'voter-2-different-claim' });
    const cookies = startRes.headers['set-cookie'];
    const state = startRes.headers.location.match(/state=([^&]+)/)![1];

    const res = await request(app)
      .get(`/api/elections/${electionId}/voters/verify-identity/callback`)
      .set('Cookie', cookies)
      .query({ state, code: 'mock-auth-code' });
    expect(res.status).toBe(409);
  });
});
