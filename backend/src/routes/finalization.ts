/**
 * Election finalization - see docs/protocol.md, "Stage: Finalization".
 *
 * Before this existed, `Election.merkleRoot` was a plain mutable database
 * column: a receipt verifier had nothing to check a Merkle proof against
 * except "whatever the database currently contains," which is exactly the
 * "a server shouldn't be able to say 'here is the final Merkle root' and
 * then control the only copy" problem this stage exists to close. This
 * produces one signed, append-only manifest per election - not updated,
 * not regenerable, checked by callers instead of the live column.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import crypto from '../crypto/engine';
import { domainHash, DOMAIN } from '../crypto/canonical';

const router = Router();

export class FinalizationError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Core finalization logic, shared by POST /:electionId/finalize and the
 * quorum-gated FINALIZE action in routes/election-approvals.ts - one real
 * implementation of "exactly one authoritative finalization event" (see
 * docs/protocol.md, "Stage: Finalization"), not two copies that could drift.
 * Idempotent-safe: a second call returns the existing manifest rather than
 * producing a second, different one. Throws FinalizationError (with a
 * status code) on any failure - callers decide how to surface it.
 */
export async function finalizeElection(electionId: string): Promise<{ alreadyFinalized: boolean; finalization: any; timestampAnchor: { submitted: boolean; note?: string } }> {
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: { candidates: true },
  });
  if (!election) throw new FinalizationError(404, 'Election not found');
  if (!election.signingPrivateKey || !election.signingPublicKey) {
    throw new FinalizationError(500, 'Election has no signing keypair configured');
  }

  const existing = await prisma.electionFinalization.findUnique({ where: { electionId } });
  if (existing) {
    return { alreadyFinalized: true, finalization: existing, timestampAnchor: { submitted: !!existing.otsProofBase64 } };
  }

  if (election.status !== 'VOTING') {
    throw new FinalizationError(409, `Election must be in VOTING status to finalize (current: ${election.status})`);
  }

  const snapshot = await prisma.electorateSnapshot.findUnique({ where: { electionId } });
  const ballotCount = await prisma.vote.count({ where: { electionId } });

  const configurationHash = domainHash(DOMAIN.ELECTION_CONFIG, {
    electionId,
    name: election.name,
    type: election.type,
    category: election.category,
    startDate: election.startDate,
    endDate: election.endDate,
    publicKey: election.publicKey,
    candidates: election.candidates.map(c => ({ id: c.id, name: c.name })).sort((a, b) => a.id.localeCompare(b.id)),
  });

  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: { electionId },
    orderBy: { timestamp: 'asc' },
    select: { dataHash: true },
  });
  const ledgerRoot = ledgerEntries.length > 0
    ? domainHash(DOMAIN.ELECTION_LEDGER, ledgerEntries.map(e => e.dataHash))
    : null;

  const manifest = {
    electionId,
    configurationHash,
    eligibilityRoot: snapshot?.snapshotHash || null,
    finalBallotRoot: election.merkleRoot || null,
    ledgerRoot,
    ballotCount,
    finalizationTimestamp: new Date().toISOString(),
  };
  const manifestHash = domainHash(DOMAIN.ELECTION_FINALIZE, manifest);
  const signature = crypto.signData(manifestHash, election.signingPrivateKey);

  const result = await prisma.$transaction(async tx => {
    const finalization = await tx.electionFinalization.create({
      data: {
        electionId,
        configurationHash,
        eligibilityRoot: manifest.eligibilityRoot || '',
        finalBallotRoot: manifest.finalBallotRoot || '',
        ledgerRoot: manifest.ledgerRoot,
        ballotCount,
        finalizationTimestamp: new Date(manifest.finalizationTimestamp),
        manifestHash,
        signature,
        signerPublicKey: election.signingPublicKey!,
      },
    });
    // COMPLETED is the closest existing status value to the protocol
    // spec's CLOSED - see docs/protocol.md's note on the status field
    // naming mismatch between the spec and the current schema enum.
    await tx.election.update({ where: { id: electionId }, data: { status: 'COMPLETED' } });
    return finalization;
  });

  // Real external timestamp anchoring (OpenTimestamps) - best-effort: a
  // network hiccup submitting to the calendar servers must not fail
  // finalization itself (the signed manifest above is already the
  // authoritative record). No financial transaction, wallet, or token is
  // involved - see docs/cryptography.md. The anchor can be (re)submitted
  // later via the /anchor endpoint if this fails here.
  let anchor: { otsProofBase64: string; submittedAt: number } | null = null;
  try {
    anchor = await crypto.submitTimestampAnchor(manifestHash);
    await prisma.electionFinalization.update({
      where: { electionId },
      data: { otsProofBase64: anchor.otsProofBase64, otsSubmittedAt: new Date(anchor.submittedAt) },
    });
  } catch (anchorError: any) {
    // Best-effort - see comment above.
  }

  return {
    alreadyFinalized: false,
    finalization: result,
    timestampAnchor: anchor ? { submitted: true } : { submitted: false, note: 'Anchor submission failed or is unavailable; retry via POST /:electionId/finalization/anchor' },
  };
}

/**
 * POST /api/elections/:electionId/finalize
 * See finalizeElection() above for the actual logic.
 */
router.post('/:electionId/finalize', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const result = await finalizeElection(electionId);
    return res.status(result.alreadyFinalized ? 200 : 201).json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof FinalizationError) {
      return res.status(error.status).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/elections/:electionId/finalization
 * Fetch the signed manifest, and independently re-verify its signature
 * before returning it - a caller should never have to trust that this
 * endpoint itself didn't just make the signature up.
 */
router.get('/:electionId/finalization', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const finalization = await prisma.electionFinalization.findUnique({ where: { electionId } });
    if (!finalization) {
      return res.status(404).json({ success: false, error: 'Election has not been finalized' });
    }

    const manifest = {
      electionId: finalization.electionId,
      configurationHash: finalization.configurationHash,
      eligibilityRoot: finalization.eligibilityRoot || null,
      finalBallotRoot: finalization.finalBallotRoot || null,
      ledgerRoot: finalization.ledgerRoot,
      ballotCount: finalization.ballotCount,
      finalizationTimestamp: finalization.finalizationTimestamp.toISOString(),
    };
    const recomputedHash = domainHash(DOMAIN.ELECTION_FINALIZE, manifest);
    const hashMatches = recomputedHash === finalization.manifestHash;
    const signatureValid = hashMatches
      && crypto.verifySignature(finalization.manifestHash, finalization.signature, finalization.signerPublicKey);

    return res.json({
      success: true,
      finalization,
      verified: {
        manifestHashMatches: hashMatches,
        signatureValid,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/elections/:electionId/finalization/anchor
 * (Re)submit the finalization manifest hash to OpenTimestamps if it
 * hasn't been anchored yet, or if the caller wants to retry after a
 * previous failed attempt.
 */
router.post('/:electionId/finalization/anchor', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const finalization = await prisma.electionFinalization.findUnique({ where: { electionId } });
    if (!finalization) {
      return res.status(404).json({ success: false, error: 'Election has not been finalized' });
    }

    const anchor = await crypto.submitTimestampAnchor(finalization.manifestHash);
    const updated = await prisma.electionFinalization.update({
      where: { electionId },
      data: { otsProofBase64: anchor.otsProofBase64, otsSubmittedAt: new Date(anchor.submittedAt) },
    });

    return res.json({ success: true, finalization: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/elections/:electionId/finalization/anchor
 * Check whether the timestamp anchor has been confirmed by the public
 * timestamp ledger yet. This will honestly report unconfirmed for the
 * first several hours after submission - that is expected, not a failure.
 */
router.get('/:electionId/finalization/anchor', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const finalization = await prisma.electionFinalization.findUnique({ where: { electionId } });
    if (!finalization) {
      return res.status(404).json({ success: false, error: 'Election has not been finalized' });
    }
    if (!finalization.otsProofBase64) {
      return res.json({ success: true, anchored: false, note: 'No anchor has been submitted yet - POST to this URL to submit one.' });
    }

    const status = await crypto.checkTimestampAnchor(finalization.otsProofBase64);
    if (status.confirmed && status.upgradedProofBase64) {
      await prisma.electionFinalization.update({
        where: { electionId },
        data: { otsProofBase64: status.upgradedProofBase64, otsConfirmed: true, otsCheckedAt: new Date() },
      });
    } else {
      await prisma.electionFinalization.update({ where: { electionId }, data: { otsCheckedAt: new Date() } });
    }

    return res.json({
      success: true,
      anchored: true,
      confirmed: status.confirmed,
      detail: status.detail,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
