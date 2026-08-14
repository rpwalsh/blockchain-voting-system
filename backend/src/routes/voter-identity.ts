/**
 * Voter identity verification via real external identity-proofing OIDC
 * providers (ID.me, Login.gov, or any standards-compliant OIDC IdP) - see
 * docs/protocol.md "Stage: Voter enrollment". This is separate from the
 * admin-SSO OIDC flow in routes/governance.ts (same underlying protocol
 * and client cache, different purpose): a successful callback here doesn't
 * create or log in a User account, it records that a specific claimed
 * externalId was backed by a real verified person before
 * routes/ballot.ts's register endpoint will accept it.
 */

import { Router, Request, Response } from 'express';
import { generators } from 'openid-client';
import { prisma } from '../db';
import { getOidcClient } from './governance';

const router = Router();

const VERIFICATION_TTL_MS = 60 * 60 * 1000; // 1 hour to complete registration after verifying
const STATE_COOKIE = 'voter_identity_oidc';

/**
 * GET /:electionId/voters/verify-identity/start?externalId=...
 * Redirects to the org's configured VOTER_IDENTITY_VERIFICATION provider.
 */
router.get('/:electionId/voters/verify-identity/start', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const externalId = String(req.query.externalId || '');
    if (!externalId) {
      return res.status(400).json({ success: false, error: 'externalId query param required' });
    }

    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, error: 'Election not found' });

    const provider = await prisma.organizationAuthProvider.findFirst({
      where: { organizationId: election.organizationId, purpose: 'VOTER_IDENTITY_VERIFICATION', enabled: true },
    });
    if (!provider) {
      return res.status(404).json({ success: false, error: 'No identity verification provider configured for this election' });
    }

    const client = await getOidcClient(provider);
    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    res.cookie(STATE_COOKIE, { electionId, externalId, providerId: provider.id, state, nonce, codeVerifier }, {
      httpOnly: true,
      signed: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000,
    });

    const authorizationUrl = client.authorizationUrl({
      scope: provider.scopes || 'openid profile email',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return res.redirect(authorizationUrl);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /:electionId/voters/verify-identity/callback
 * Real OIDC token exchange; records a VoterIdentityVerification on success.
 */
router.get('/:electionId/voters/verify-identity/callback', async (req: any, res: Response) => {
  try {
    const { electionId } = req.params;
    const cookie = req.signedCookies?.[STATE_COOKIE];
    if (!cookie || cookie.electionId !== electionId) {
      return res.status(400).json({ success: false, error: 'Missing or mismatched verification state cookie' });
    }

    const { state, code } = req.query || {};
    if (!state || !code) {
      return res.status(400).json({ success: false, error: 'Missing code/state' });
    }
    if (state !== cookie.state) {
      return res.status(400).json({ success: false, error: 'Invalid state' });
    }

    const provider = await prisma.organizationAuthProvider.findUnique({ where: { id: cookie.providerId } });
    if (!provider || !provider.enabled || provider.purpose !== 'VOTER_IDENTITY_VERIFICATION') {
      return res.status(400).json({ success: false, error: 'Identity verification provider disabled or reconfigured' });
    }

    const client = await getOidcClient(provider);
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(provider.redirectUri, params, {
      state: cookie.state,
      nonce: cookie.nonce,
      code_verifier: cookie.codeVerifier,
    });

    const claims: any = tokenSet.claims();
    const subjectClaim = provider.subjectClaim || 'sub';
    const subject = claims[subjectClaim];
    if (!subject || typeof subject !== 'string') {
      return res.status(400).json({ success: false, error: `OIDC claim '${subjectClaim}' missing/invalid` });
    }

    try {
      await prisma.voterIdentityVerification.create({
        data: {
          electionId,
          providerId: provider.id,
          externalId: cookie.externalId,
          subjectClaim: subject,
          expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return res.status(409).json({
          success: false,
          error: 'This verified identity has already been used for a different externalId in this election',
        });
      }
      throw error;
    }

    res.clearCookie(STATE_COOKIE);
    return res.json({ success: true, verified: true, externalId: cookie.externalId, expiresInMs: VERIFICATION_TTL_MS });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
