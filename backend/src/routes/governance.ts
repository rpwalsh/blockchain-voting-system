/**
 * SPDX-License-Identifier: LicenseRef-Proprietary
 * Copyright (c) 2026 blockchain-voting-system.
 * Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.
 *
 * blockchain-voting-system governance suite
 * - Multi-tenant org config
 * - Provider-agnostic SSO (OIDC)
 * - Membership import + eligibility snapshots
 * - Governance election creation helpers
 * - Verifier + Proof Pack export
 */

import { Router, Request, Response } from 'express';
import { parse as parseCsv } from 'csv-parse/sync';
import { Issuer, generators } from 'openid-client';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../db';
import crypto from '../crypto/engine';
import { domainHash, DOMAIN } from '../crypto/canonical';
import { requireAuth, requireOrgRole, requireSuperAdmin, AuthedRequest } from '../middleware/auth';
import { loadConfig } from '../config';

const router = Router();

const config = loadConfig();
const JWT_SECRET = config.jwtSecret;
const JWT_EXPIRES_IN: SignOptions['expiresIn'] = config.jwtExpiresIn as any;

const oidcClientCache = new Map<string, any>();

async function getOidcClient(provider: any) {
  const cacheKey = `${provider.id}:${provider.updatedAt?.toISOString?.() || String(provider.updatedAt)}`;
  const cached = oidcClientCache.get(cacheKey);
  if (cached) return cached;

  const issuer = await Issuer.discover(provider.issuerUrl);
  const client = new issuer.Client({
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    redirect_uris: [provider.redirectUri],
    response_types: ['code'],
  });

  oidcClientCache.set(cacheKey, client);
  return client;
}

type EligibilityExpression = {
  all?: Array<{ field: string; op: 'eq' | 'neq' | 'in' | 'nin' | 'exists'; value?: any }>;
  any?: Array<{ field: string; op: 'eq' | 'neq' | 'in' | 'nin' | 'exists'; value?: any }>;
};

function evaluateEligibility(member: any, expr: EligibilityExpression): boolean {
  const evalClause = (clause: { field: string; op: any; value?: any }) => {
    const v = member[clause.field];
    switch (clause.op) {
      case 'eq':
        return v === clause.value;
      case 'neq':
        return v !== clause.value;
      case 'in':
        return Array.isArray(clause.value) ? clause.value.includes(v) : false;
      case 'nin':
        return Array.isArray(clause.value) ? !clause.value.includes(v) : true;
      case 'exists':
        return v !== null && v !== undefined && v !== '';
      default:
        return false;
    }
  };

  if (expr.all && expr.all.length > 0) {
    if (!expr.all.every(evalClause)) return false;
  }
  if (expr.any && expr.any.length > 0) {
    if (!expr.any.some(evalClause)) return false;
  }

  return true;
}

async function getOrCreateOrgSettings(organizationId: string) {
  const existing = await prisma.organizationSettings.findUnique({ where: { organizationId } });
  if (existing) return existing;
  return prisma.organizationSettings.create({ data: { organizationId } });
}

router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    product: 'blockchain-voting-system',
    mode: process.env.GOVERNANCE_MODE || 'GOVERNANCE',
    tenantMode: process.env.TENANT_MODE || 'MULTI',
  });
});

/**
 * OIDC SSO: start login
 * GET /api/governance/sso/oidc/:orgSlug/:providerName/login
 */
router.get('/sso/oidc/:orgSlug/:providerName/login', async (req: Request, res: Response) => {
  try {
    const { orgSlug, providerName } = req.params;

    const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

    const provider = await prisma.organizationAuthProvider.findFirst({
      where: {
        organizationId: org.id,
        name: providerName,
        type: 'OIDC',
        enabled: true,
      },
    });

    if (!provider) {
      return res.status(404).json({ success: false, error: 'OIDC provider not configured/enabled' });
    }

    const client = await getOidcClient(provider);

    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    res.cookie(
      'governance_oidc',
      {
        orgId: org.id,
        providerId: provider.id,
        state,
        nonce,
        codeVerifier,
        createdAt: Date.now(),
      },
      {
        httpOnly: true,
        signed: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 10 * 60 * 1000,
      }
    );

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
 * OIDC SSO: callback
 * GET /api/governance/sso/oidc/callback
 */
router.get('/sso/oidc/callback', async (req: any, res: Response) => {
  try {
    const cookie = req.signedCookies?.governance_oidc;
    if (!cookie) {
      return res.status(400).json({ success: false, error: 'Missing SSO state cookie' });
    }

    const { state, code } = req.query || {};
    if (!state || !code) {
      return res.status(400).json({ success: false, error: 'Missing code/state' });
    }
    if (state !== cookie.state) {
      return res.status(400).json({ success: false, error: 'Invalid state' });
    }

    const provider = await prisma.organizationAuthProvider.findUnique({ where: { id: cookie.providerId } });
    if (!provider || !provider.enabled) {
      return res.status(400).json({ success: false, error: 'SSO provider disabled' });
    }

    const org = await prisma.organization.findUnique({ where: { id: cookie.orgId } });
    if (!org) return res.status(400).json({ success: false, error: 'Organization not found' });

    const client = await getOidcClient(provider);
    const params = client.callbackParams(req);

    const tokenSet = await client.callback(provider.redirectUri, params, {
      state: cookie.state,
      nonce: cookie.nonce,
      code_verifier: cookie.codeVerifier,
    });

    const claims: any = tokenSet.claims();
    const emailClaim = provider.emailClaim || 'email';
    const subjectClaim = provider.subjectClaim || 'sub';

    const email = claims[emailClaim];
    const subject = claims[subjectClaim];

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: `OIDC claim '${emailClaim}' missing/invalid` });
    }

    // Upsert user in org (SSO-only users have null passwordHash)
    const user = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: org.id, email } },
      create: {
        organizationId: org.id,
        email,
        username: email.split('@')[0],
        passwordHash: null,
        firstName: claims.given_name || null,
        lastName: claims.family_name || null,
        role: 'VIEWER',
        isActive: true,
        permissions: subject ? JSON.stringify({ oidcSub: subject, provider: provider.name }) : null,
      },
      update: {
        firstName: claims.given_name || null,
        lastName: claims.family_name || null,
        isActive: true,
        permissions: subject ? JSON.stringify({ oidcSub: subject, provider: provider.name }) : undefined,
        lastLoginAt: new Date(),
      },
      include: { organization: true },
    });

    // Issue JWT for API
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, orgId: user.organizationId },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Clear state cookie
    res.clearCookie('governance_oidc');

    const appUrl = process.env.GOVERNANCE_APP_URL;
    const wantsHtml = String(req.headers.accept || '').includes('text/html');
    if (appUrl && wantsHtml) {
      const redirectTo = `${appUrl.replace(/\/$/, '')}/sso?token=${encodeURIComponent(token)}`;
      return res.redirect(redirectTo);
    }

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        organization: { id: user.organization.id, name: user.organization.name, slug: user.organization.slug },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Superadmin: create an organization with default GOVERNANCE settings
 */
router.post('/orgs', requireAuth, requireSuperAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { name, slug, type, primaryContact, email } = req.body || {};

    if (!name || !slug || !type || !primaryContact || !email) {
      return res.status(400).json({ success: false, error: 'name, slug, type, primaryContact, email required' });
    }

    const orgKeyPair = crypto.generateKeyPair();

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        type,
        primaryContact,
        email,
        publicKey: orgKeyPair.publicKey,
        apiKey: crypto.generateVotingToken(),
      },
    });

    const settings = await prisma.organizationSettings.create({
      data: {
        organizationId: org.id,
        mode: 'GOVERNANCE',
        tenantMode: 'MULTI',
        authMode: 'LOCAL',
        complianceProfile: 'GOVERNMENT',
      },
    });

    return res.status(201).json({ success: true, organization: org, settings });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Org: get org profile + settings + configured auth providers
 */
router.get('/org', requireAuth, requireOrgRole(['ORG_ADMIN', 'ELECTION_OFFICER', 'AUDITOR', 'VIEWER', 'VOTER']), async (req: AuthedRequest, res: Response) => {
  try {
    const orgId = req.auth!.orgId!;

    const [org, settings, providers] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId } }),
      getOrCreateOrgSettings(orgId),
      prisma.organizationAuthProvider.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          type: true,
          name: true,
          enabled: true,
          issuerUrl: true,
          clientId: true,
          redirectUri: true,
          scopes: true,
          emailClaim: true,
          subjectClaim: true,
          rolesClaim: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

    return res.json({ success: true, organization: org, settings, authProviders: providers });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Org admin: update settings
 */
router.put('/org/settings', requireAuth, requireOrgRole(['ORG_ADMIN']), async (req: AuthedRequest, res: Response) => {
  try {
    const orgId = req.auth!.orgId!;
    const allowed = [
      'mode',
      'tenantMode',
      'authMode',
      'requireMfaAdmins',
      'allowSelfJoin',
      'selfJoinDomain',
      'brandName',
      'brandLogoUrl',
      'brandPrimaryColor',
      'complianceProfile',
    ];

    const patch: any = {};
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) patch[key] = req.body[key];
    }

    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, ...patch },
      update: patch,
    });

    return res.json({ success: true, settings });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Org admin: configure an OIDC provider (Auth0/Okta/AzureAD/Google/etc)
 */
router.post('/org/auth/oidc', requireAuth, requireOrgRole(['ORG_ADMIN']), async (req: AuthedRequest, res: Response) => {
  try {
    const orgId = req.auth!.orgId!;
    const {
      name,
      issuerUrl,
      clientId,
      clientSecret,
      redirectUri,
      scopes,
      enabled,
      emailClaim,
      subjectClaim,
      rolesClaim,
    } = req.body || {};

    if (!name || !issuerUrl || !clientId || !clientSecret || !redirectUri) {
      return res.status(400).json({
        success: false,
        error: 'name, issuerUrl, clientId, clientSecret, redirectUri required',
      });
    }

    const provider = await prisma.organizationAuthProvider.upsert({
      where: { organizationId_name: { organizationId: orgId, name } },
      create: {
        organizationId: orgId,
        type: 'OIDC',
        name,
        issuerUrl,
        clientId,
        clientSecret,
        redirectUri,
        scopes: scopes || 'openid profile email',
        enabled: enabled !== undefined ? !!enabled : true,
        emailClaim: emailClaim || 'email',
        subjectClaim: subjectClaim || 'sub',
        rolesClaim: rolesClaim || null,
      },
      update: {
        issuerUrl,
        clientId,
        clientSecret,
        redirectUri,
        scopes: scopes || 'openid profile email',
        enabled: enabled !== undefined ? !!enabled : true,
        emailClaim: emailClaim || 'email',
        subjectClaim: subjectClaim || 'sub',
        rolesClaim: rolesClaim || null,
      },
      select: {
        id: true,
        type: true,
        name: true,
        enabled: true,
        issuerUrl: true,
        clientId: true,
        redirectUri: true,
        scopes: true,
        emailClaim: true,
        subjectClaim: true,
        rolesClaim: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(201).json({ success: true, authProvider: provider });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Org admin: import membership roster
 * Accepts either:
 * - { format: 'csv', csv: 'externalId,email,displayName,duesCurrent,unit,worksite' }
 * - { format: 'json', members: [...] }
 */
router.post('/members/import', requireAuth, requireOrgRole(['ORG_ADMIN']), async (req: AuthedRequest, res: Response) => {
  try {
    const orgId = req.auth!.orgId!;
    const { format } = req.body || {};

    let rows: any[] = [];

    if (format === 'csv') {
      const csv = req.body?.csv;
      if (!csv || typeof csv !== 'string') {
        return res.status(400).json({ success: false, error: 'csv string required' });
      }

      rows = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true });
    } else if (format === 'json') {
      const members = req.body?.members;
      if (!Array.isArray(members)) {
        return res.status(400).json({ success: false, error: 'members array required' });
      }
      rows = members;
    } else {
      return res.status(400).json({ success: false, error: "format must be 'csv' or 'json'" });
    }

    const normalized = rows
      .map(r => ({
        externalId: String(r.externalId || r.id || r.memberId || '').trim(),
        email: r.email ? String(r.email).trim() : null,
        displayName: r.displayName ? String(r.displayName).trim() : null,
        duesCurrent: String(r.duesCurrent || '').toLowerCase() === 'true' || r.duesCurrent === true || r.duesCurrent === 1,
        unit: r.unit ? String(r.unit).trim() : null,
        worksite: r.worksite ? String(r.worksite).trim() : null,
        roles: r.roles ? (typeof r.roles === 'string' ? r.roles : JSON.stringify(r.roles)) : null,
        metadata: r.metadata ? (typeof r.metadata === 'string' ? r.metadata : JSON.stringify(r.metadata)) : null,
      }))
      .filter(r => r.externalId.length > 0);

    if (normalized.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid members found (externalId required)' });
    }

    const results = await prisma.$transaction(
      normalized.map(row =>
        prisma.member.upsert({
          where: { organizationId_externalId: { organizationId: orgId, externalId: row.externalId } },
          create: { organizationId: orgId, ...row },
          update: { ...row },
        })
      )
    );

    return res.json({
      success: true,
      imported: results.length,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/members', requireAuth, requireOrgRole(['ORG_ADMIN', 'ELECTION_OFFICER', 'AUDITOR']), async (req: AuthedRequest, res: Response) => {
  try {
    const orgId = req.auth!.orgId!;
    const members = await prisma.member.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return res.json({ success: true, members });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Org: list elections for this tenant (wizard-friendly)
 */
router.get('/elections', requireAuth, requireOrgRole(['ORG_ADMIN', 'ELECTION_OFFICER', 'AUDITOR', 'VIEWER']), async (req: AuthedRequest, res: Response) => {
  try {
    const orgId = req.auth!.orgId!;
    const elections = await prisma.election.findMany({
      where: { organizationId: orgId },
      include: {
        electorateSnapshot: true,
        _count: { select: { voters: true, votes: true, candidates: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return res.json({
      success: true,
      elections: elections.map(e => ({
        id: e.id,
        name: e.name,
        description: e.description,
        type: e.type,
        category: e.category,
        status: e.status,
        startDate: e.startDate,
        endDate: e.endDate,
        electorateSnapshot: e.electorateSnapshot
          ? { snapshotHash: e.electorateSnapshot.snapshotHash, memberCount: e.electorateSnapshot.memberCount }
          : null,
        stats: {
          candidates: e._count.candidates,
          registeredVoters: e._count.voters,
          votesCast: e._count.votes,
        },
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Public: list elections for an org slug (verifier-friendly)
 * Only returns non-sensitive metadata.
 */
router.get('/public/:orgSlug/elections', async (req: Request, res: Response) => {
  try {
    const { orgSlug } = req.params;
    const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

    const elections = await prisma.election.findMany({
      where: { organizationId: org.id },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        startDate: true,
        endDate: true,
        category: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return res.json({
      success: true,
      organization: { name: org.name, slug: org.slug },
      elections,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Org admin: create eligibility rule
 */
router.post('/eligibility-rules', requireAuth, requireOrgRole(['ORG_ADMIN', 'ELECTION_OFFICER']), async (req: AuthedRequest, res: Response) => {
  try {
    const orgId = req.auth!.orgId!;
    const { name, expression } = req.body || {};

    if (!name || !expression) {
      return res.status(400).json({ success: false, error: 'name and expression required' });
    }

    // Validate JSON and normalize to string
    const exprObj = typeof expression === 'string' ? JSON.parse(expression) : expression;

    const rule = await prisma.eligibilityRule.create({
      data: {
        organizationId: orgId,
        name,
        expression: JSON.stringify(exprObj),
      },
    });

    return res.status(201).json({ success: true, rule });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/eligibility-rules', requireAuth, requireOrgRole(['ORG_ADMIN', 'ELECTION_OFFICER', 'AUDITOR']), async (req: AuthedRequest, res: Response) => {
  try {
    const orgId = req.auth!.orgId!;
    const rules = await prisma.eligibilityRule.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, rules });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Org officer: create a governance election with electorate snapshot locked at creation.
 */
router.post('/elections', requireAuth, requireOrgRole(['ORG_ADMIN', 'ELECTION_OFFICER']), async (req: AuthedRequest, res: Response) => {
  try {
    const orgId = req.auth!.orgId!;
    const { name, description, category, startDate, endDate, eligibilityRuleId, candidates } = req.body || {};

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'name, startDate, endDate required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const electionKeyPair = crypto.generateElectionKeyPair();

    const rule = eligibilityRuleId
      ? await prisma.eligibilityRule.findFirst({ where: { id: eligibilityRuleId, organizationId: orgId } })
      : null;

    const allMembers = await prisma.member.findMany({ where: { organizationId: orgId, isActive: true } });
    const expr: EligibilityExpression = rule ? JSON.parse(rule.expression) : { all: [{ field: 'isActive', op: 'eq', value: true }] };

    const eligible = allMembers.filter((m: any) => evaluateEligibility(m, expr));
    const eligibleExternalIds = eligible.map((m: any) => m.externalId).sort();

    const snapshotHash = domainHash(DOMAIN.ELECTION_ELIGIBILITY, {
      rule: rule ? { id: rule.id, expression: rule.expression } : null,
      members: eligibleExternalIds,
    });

    const report = {
      generatedAt: new Date().toISOString(),
      rule: rule ? { id: rule.id, name: rule.name } : { id: null, name: 'isActive==true (default)' },
      memberCount: eligible.length,
      unitBreakdown: eligible.reduce((acc: any, m: any) => {
        const k = m.unit || 'UNSPECIFIED';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
    };

    const signingKeyPair = crypto.generateKeyPair();
    const keyShares = crypto.splitSecretShamir(electionKeyPair.privateKey, 3, 5);

    const created = await prisma.$transaction(async tx => {
      const election = await tx.election.create({
        data: {
          organizationId: orgId,
          name,
          description: description || null,
          type: 'UNION_GOVERNANCE',
          category: category || 'MOTION',
          startDate: start,
          endDate: end,
          status: 'DRAFT',
          publicKey: electionKeyPair.publicKey,
          privateKeyHash: crypto.hashVotingToken(electionKeyPair.privateKey),
          privateKey: electionKeyPair.privateKey,
          keyShares: JSON.stringify(keyShares),
          signingPublicKey: signingKeyPair.publicKey,
          signingPrivateKey: signingKeyPair.privateKey,
        },
      });

      // Candidates are optional depending on vote type
      if (Array.isArray(candidates) && candidates.length > 0) {
        await tx.candidate.createMany({
          data: candidates.map((c: any, idx: number) => ({
            electionId: election.id,
            name: String(c.name || '').trim(),
            party: c.party ? String(c.party).trim() : null,
            description: c.description ? String(c.description).trim() : null,
            order: typeof c.order === 'number' ? c.order : idx,
          })),
        });
      }

      const snapshot = await tx.electorateSnapshot.create({
        data: {
          organizationId: orgId,
          electionId: election.id,
          eligibilityRuleId: rule?.id || null,
          snapshotHash,
          memberCount: eligible.length,
          reportJson: JSON.stringify(report),
        },
      });

      if (eligible.length > 0) {
        await tx.snapshotMember.createMany({
          data: eligible.map((m: any) => ({ snapshotId: snapshot.id, memberId: m.id })),
          skipDuplicates: true,
        });
      }

      return { election, snapshot };
    });

    return res.status(201).json({ success: true, ...created, report });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Verifier: receipt inclusion proof (wraps existing crypto audit semantics)
 */
router.post('/verifier/receipt', async (req: Request, res: Response) => {
  const { receiptHash, electionId } = req.body || {};
  if (!receiptHash || !electionId) {
    return res.status(400).json({ success: false, error: 'receiptHash and electionId required' });
  }

  try {
    const vote = await prisma.vote.findFirst({
      where: { receiptHash, electionId },
      include: { election: true },
    });

    if (!vote) {
      return res.json({ success: true, verified: false, message: 'No vote found with this receipt hash' });
    }

    const allVotes = await prisma.vote.findMany({ where: { electionId }, orderBy: { ledgerTimestamp: 'asc' } });
    const voteHashes = allVotes.map((v: any) => v.encryptedVote);
    const voteIndex = allVotes.findIndex((v: any) => v.id === vote.id);

    const tree = new crypto.MerkleTree(voteHashes);
    const proof = tree.getProof(voteIndex);
    const proofValid = crypto.MerkleTree.verifyProof(proof);

    return res.json({
      success: true,
      verified: true,
      receipt: {
        receiptHash,
        electionId,
        electionName: vote.election.name,
        merkleRoot: proof.root,
        included: proofValid,
        index: voteIndex,
        totalVotes: allVotes.length,
        proof,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Proof Pack (JSON today; PDF can be layered on)
 */
router.get('/elections/:electionId/proof-pack', requireAuth, requireOrgRole(['ORG_ADMIN', 'ELECTION_OFFICER', 'AUDITOR']), async (req: AuthedRequest, res: Response) => {
  try {
    const orgId = req.auth!.orgId!;
    const { electionId } = req.params;

    const election = await prisma.election.findFirst({
      where: { id: electionId, organizationId: orgId },
      include: {
        candidates: true,
        tallyResults: true,
        ledgerEntries: { orderBy: { timestamp: 'asc' } },
      },
    });

    if (!election) return res.status(404).json({ success: false, error: 'Election not found' });

    const snapshot = await prisma.electorateSnapshot.findUnique({
      where: { electionId: election.id },
      include: { eligibilityRule: true },
    });

    const votes = await prisma.vote.findMany({
      where: { electionId: election.id },
      orderBy: { ledgerTimestamp: 'asc' },
      select: {
        id: true,
        receiptHash: true,
        ledgerEntryHash: true,
        merkleRoot: true,
        ledgerTimestamp: true,
      },
    });

    const pack: {
      version: string;
      generatedAt: string;
      organizationId: string;
      election: any;
      electorateSnapshot: any;
      results: any;
      artifacts: any;
      integrity: {
        packHash: string;
        signature: string | null;
        signatureAlgorithm: string | null;
        note: string;
        signingPublicKey?: string;
      };
    } = {
      version: 'GOVERNANCE-PROOF-PACK-1',
      generatedAt: new Date().toISOString(),
      organizationId: orgId,
      election: {
        id: election.id,
        name: election.name,
        description: election.description,
        type: election.type,
        category: election.category,
        status: election.status,
        startDate: election.startDate,
        endDate: election.endDate,
        publicKey: election.publicKey,
        merkleRoot: election.merkleRoot,
      },
      electorateSnapshot: snapshot
        ? {
            snapshotHash: snapshot.snapshotHash,
            memberCount: snapshot.memberCount,
            report: JSON.parse(snapshot.reportJson),
            eligibilityRule: snapshot.eligibilityRule
              ? { id: snapshot.eligibilityRule.id, name: snapshot.eligibilityRule.name, expression: snapshot.eligibilityRule.expression }
              : null,
          }
        : null,
      results: {
        tallyResults: election.tallyResults,
        votesSummary: {
          totalVotes: votes.length,
          lastMerkleRoot: votes.length > 0 ? votes[votes.length - 1].merkleRoot : null,
        },
      },
      artifacts: {
        ledgerEntries: election.ledgerEntries,
        voteReceipts: votes.map(v => ({
          receiptHash: v.receiptHash,
          ledgerEntryHash: v.ledgerEntryHash,
          merkleRoot: v.merkleRoot,
          timestamp: v.ledgerTimestamp,
        })),
      },
      integrity: {
        packHash: domainHash(DOMAIN.ELECTION_LEDGER, { orgId, electionId: election.id, snapshot: snapshot?.snapshotHash || null, votes: votes.map(v => v.ledgerEntryHash) }),
        signature: null,
        signatureAlgorithm: null,
        note: 'Set PROOF_PACK_SIGNING_PRIVATE_KEY to enable signatures',
      },
    };

    // Optional signing (Ed25519)
    const signingPrivateKey = process.env.PROOF_PACK_SIGNING_PRIVATE_KEY;
    const signingPublicKey = process.env.PROOF_PACK_SIGNING_PUBLIC_KEY;
    if (signingPrivateKey && signingPublicKey) {
      const packHash = pack.integrity.packHash;
      const signature = crypto.signData(packHash, signingPrivateKey);
      pack.integrity.signature = signature;
      pack.integrity.signatureAlgorithm = 'ed25519';
      pack.integrity.signingPublicKey = signingPublicKey;
    }

    return res.json({ success: true, proofPack: pack });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
