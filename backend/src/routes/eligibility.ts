/**
 * Anonymous eligibility - see docs/protocol.md "Stage: Credential issuance"
 * and backend/circuits/eligibility.circom.
 *
 * Enrollment is identified (the caller must already be a registered voter,
 * i.e. authenticated the same way as voters/register in ballot.ts) but the
 * commitment it submits is opaque to the server - only the voter knows the
 * secret behind it. Later, at vote time, membership in the resulting tree
 * is proven anonymously (routes/ballot.ts's vote endpoint), so the server
 * never learns which enrolled voter cast which ballot.
 */

import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { PoseidonMerkleTree } from '../crypto/engine';

const router = Router();

type Db = typeof prisma | Prisma.TransactionClient;

async function currentTree(db: Db, electionId: string): Promise<PoseidonMerkleTree> {
  const leaves = await db.eligibilityCommitment.findMany({
    where: { electionId, revoked: false },
    orderBy: { leafIndex: 'asc' },
  });
  return new PoseidonMerkleTree(leaves.map(l => l.commitment));
}

/**
 * POST /api/elections/:electionId/eligibility/enroll
 * Body: { votingTokenHash, commitment }
 * Authenticates the caller the same way vote-casting used to (by their
 * registered token hash), then adds their eligibility commitment as a new
 * leaf and republishes the election's current eligibility root. Only
 * allowed before voting opens - the root must be stable once voters start
 * proving membership against it.
 */
router.post('/:electionId/eligibility/enroll', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const { votingTokenHash, commitment } = req.body || {};

    if (!votingTokenHash || !commitment) {
      return res.status(400).json({ success: false, error: 'votingTokenHash and commitment are required' });
    }

    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, error: 'Election not found' });
    if (!['DRAFT', 'REGISTRATION'].includes(election.status)) {
      return res.status(409).json({ success: false, error: `Election status ${election.status} does not accept eligibility enrollment` });
    }

    const voter = await prisma.voter.findUnique({ where: { votingTokenHash } });
    if (!voter || voter.electionId !== electionId) {
      return res.status(403).json({ success: false, error: 'Unknown voting token for this election' });
    }

    const existing = await prisma.eligibilityCommitment.findUnique({
      where: { electionId_commitment: { electionId, commitment } },
    });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Commitment already enrolled' });
    }

    // leafIndex assignment races under concurrent enrollment; the
    // @@unique([electionId, leafIndex]) constraint rejects a collision
    // instead of silently overwriting a slot, so retry with a fresh count.
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const leafCount = await prisma.eligibilityCommitment.count({ where: { electionId } });
      try {
        const root = await prisma.$transaction(async tx => {
          await tx.eligibilityCommitment.create({
            data: { electionId, leafIndex: leafCount, commitment },
          });
          const tree = await currentTree(tx, electionId);
          const newRoot = await tree.getRoot();
          await tx.election.update({ where: { id: electionId }, data: { eligibilityRoot: newRoot } });
          return newRoot;
        });
        return res.status(201).json({ success: true, eligibilityRoot: root, leafIndex: leafCount });
      } catch (error: any) {
        if (error?.code !== 'P2002' || attempt === MAX_ATTEMPTS) throw error;
      }
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/elections/:electionId/eligibility/path?commitment=...
 * Returns the Merkle path for a specific (non-revoked) commitment against
 * the election's current eligibility root. Lookup is by the commitment
 * itself, not by voter identity - presenting your own commitment doesn't
 * leak anything beyond what its holder already knows.
 */
router.get('/:electionId/eligibility/path', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const commitment = String(req.query.commitment || '');
    if (!commitment) {
      return res.status(400).json({ success: false, error: 'commitment query param required' });
    }

    const leaf = await prisma.eligibilityCommitment.findUnique({
      where: { electionId_commitment: { electionId, commitment } },
    });
    if (!leaf || leaf.revoked) {
      return res.status(404).json({ success: false, error: 'Commitment not found or revoked' });
    }

    const tree = await currentTree(prisma, electionId);
    const proof = await tree.getProof(leaf.leafIndex);
    const root = await tree.getRoot();

    return res.json({ success: true, root, ...proof });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/elections/:electionId/eligibility/revoke
 * Body: { commitment }
 * Marks a commitment revoked and republishes the root, excluding it from
 * future membership proofs. Only allowed before voting opens - see
 * docs/protocol.md for why a mid-election revocation window is out of
 * scope here (it would require accepting proofs against a set of recent
 * roots rather than just the current one).
 */
router.post('/:electionId/eligibility/revoke', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const { commitment } = req.body || {};
    if (!commitment) {
      return res.status(400).json({ success: false, error: 'commitment is required' });
    }

    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, error: 'Election not found' });
    if (!['DRAFT', 'REGISTRATION'].includes(election.status)) {
      return res.status(409).json({ success: false, error: `Election status ${election.status} does not accept eligibility revocation` });
    }

    const leaf = await prisma.eligibilityCommitment.findUnique({
      where: { electionId_commitment: { electionId, commitment } },
    });
    if (!leaf || leaf.revoked) {
      return res.status(404).json({ success: false, error: 'Commitment not found or already revoked' });
    }

    const root = await prisma.$transaction(async tx => {
      await tx.eligibilityCommitment.update({
        where: { id: leaf.id },
        data: { revoked: true, revokedAt: new Date() },
      });
      const tree = await currentTree(tx, electionId);
      const newRoot = await tree.getRoot();
      await tx.election.update({ where: { id: electionId }, data: { eligibilityRoot: newRoot } });
      return newRoot;
    });

    return res.json({ success: true, eligibilityRoot: root });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
