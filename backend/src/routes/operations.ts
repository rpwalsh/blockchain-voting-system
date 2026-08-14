/**
 * Operational election features - see docs/protocol.md "Stage: Audit" and
 * "Stage: Recount". Recount independently recomputes everything from the
 * ledger/ballots rather than re-reading cached totals; observer mode
 * exposes real-time integrity signals with no voter- or ballot-content
 * data; audit export packages a bundle in exactly the shape
 * verifier/src/bundle.ts's --bundle mode consumes, so a real third party
 * can run Milestone 4's independent CLI against it.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import crypto, { MerkleTree } from '../crypto/engine';
import { domainHash, DOMAIN } from '../crypto/canonical';
import tally, { ElGamalCiphertext, TallyKeyShare } from '../crypto/tally';

const router = Router();

/**
 * POST /:electionId/recount
 * Recomputes, from scratch, everything a cached total could have gotten
 * wrong: walks the full ledger chain, rebuilds the ballot Merkle tree from
 * live ciphertexts, and (if a tally exists) independently re-derives each
 * candidate's count via a fresh threshold decryption. Flags any mismatch
 * against what's currently stored rather than assuming it's correct.
 */
router.post('/:electionId/recount', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, error: 'Election not found' });

    const ledgerEntries = await prisma.ledgerEntry.findMany({ where: { electionId }, orderBy: { timestamp: 'asc' } });
    let ledgerValid = true;
    const ledgerIssues: string[] = [];
    for (let i = 0; i < ledgerEntries.length; i++) {
      const entry = ledgerEntries[i];
      const prev = i > 0 ? ledgerEntries[i - 1] : null;
      const expectedDataHash = domainHash(DOMAIN.ELECTION_LEDGER, {
        electionId: entry.electionId,
        entryType: entry.entryType,
        data: entry.data,
        previousEntryHash: prev ? prev.dataHash : null,
      });
      if (expectedDataHash !== entry.dataHash) {
        ledgerValid = false;
        ledgerIssues.push(`entry ${i}: dataHash does not match recomputed hash`);
      }
      if ((entry.previousEntryHash || null) !== (prev ? prev.dataHash : null)) {
        ledgerValid = false;
        ledgerIssues.push(`entry ${i}: previousEntryHash does not match prior entry's dataHash`);
      }
      if (!crypto.verifySignature(entry.dataHash, entry.signature, entry.signerPublicKey)) {
        ledgerValid = false;
        ledgerIssues.push(`entry ${i}: signature does not verify`);
      }
    }

    const votes = await prisma.vote.findMany({ where: { electionId }, orderBy: { ledgerTimestamp: 'asc' } });
    const recomputedMerkleRoot = votes.length > 0 ? new MerkleTree(votes.map(v => v.encryptedVote)).getRoot() : null;
    const merkleMatchesLive = recomputedMerkleRoot === election.merkleRoot;

    const finalization = await prisma.electionFinalization.findUnique({ where: { electionId } });
    const merkleMatchesFinalized = finalization ? recomputedMerkleRoot === finalization.finalBallotRoot : null;

    let tallyRecount: any = null;
    const storedResults = await prisma.tallyResult.findMany({ where: { electionId } });
    if (storedResults.length > 0 && election.tallyKeyShares && election.tallyThreshold) {
      const shares: TallyKeyShare[] = JSON.parse(election.tallyKeyShares);
      const trustees = shares.slice(0, election.tallyThreshold);

      tallyRecount = storedResults.map(stored => {
        try {
          const ciphertexts: ElGamalCiphertext[] = votes
            .map(v => {
              const parsed = v.tallyCiphertexts ? JSON.parse(v.tallyCiphertexts) : null;
              const entry = parsed?.find((c: any) => c.candidateId === stored.candidateId);
              return entry?.ciphertext as ElGamalCiphertext | undefined;
            })
            .filter((c): c is ElGamalCiphertext => !!c);

          const summed = tally.homomorphicSum(ciphertexts);
          const partials = trustees.map(share => tally.computePartialDecryption(share, summed));
          const combined = tally.combinePartialDecryptions(partials);
          const recomputedCount = tally.decryptSum(summed, combined, votes.length);

          return { candidateId: stored.candidateId, certifiedCount: stored.voteCount, recomputedCount, matches: recomputedCount === stored.voteCount };
        } catch (err: any) {
          return { candidateId: stored.candidateId, certifiedCount: stored.voteCount, recomputedCount: null, matches: false, error: err.message };
        }
      });
    }

    const allMatch =
      ledgerValid &&
      merkleMatchesLive &&
      (merkleMatchesFinalized === null || merkleMatchesFinalized) &&
      (tallyRecount === null || tallyRecount.every((r: any) => r.matches));

    return res.json({
      success: true,
      recount: {
        ledgerEntriesChecked: ledgerEntries.length,
        ledgerValid,
        ledgerIssues,
        ballotsChecked: votes.length,
        recomputedMerkleRoot,
        merkleMatchesLive,
        merkleMatchesFinalized,
        tallyRecount,
        allMatch,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /:electionId/observer/status
 * Unauthenticated, read-only integrity signals for external observers -
 * aggregate counts and roots only, no per-voter or per-ballot content.
 */
router.get('/:electionId/observer/status', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, error: 'Election not found' });

    const [ledgerEntryCount, voteCount, lastLedgerEntry, finalization, tallyCount] = await Promise.all([
      prisma.ledgerEntry.count({ where: { electionId } }),
      prisma.vote.count({ where: { electionId } }),
      prisma.ledgerEntry.findFirst({ where: { electionId }, orderBy: { timestamp: 'desc' }, select: { timestamp: true, entryType: true } }),
      prisma.electionFinalization.findUnique({ where: { electionId }, select: { finalizationTimestamp: true, otsConfirmed: true } }),
      prisma.tallyResult.count({ where: { electionId } }),
    ]);

    return res.json({
      success: true,
      observer: {
        electionId,
        status: election.status,
        ledgerEntryCount,
        currentMerkleRoot: election.merkleRoot,
        voteCount,
        lastLedgerActivity: lastLedgerEntry ? { entryType: lastLedgerEntry.entryType, timestamp: lastLedgerEntry.timestamp } : null,
        finalized: !!finalization,
        finalizedAt: finalization?.finalizationTimestamp || null,
        timestampAnchorConfirmed: finalization?.otsConfirmed ?? null,
        tallyComputed: tallyCount > 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /:electionId/audit-export
 * Packages an "election-audit-bundle-1" JSON bundle - exactly the shape
 * verifier/src/bundle.ts's --bundle mode expects, so the independent
 * verifier CLI (Milestone 4) can run its full offline checks against it.
 */
router.get('/:electionId/audit-export', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, error: 'Election not found' });

    const [votes, ledgerEntries, finalization] = await Promise.all([
      prisma.vote.findMany({ where: { electionId }, orderBy: { ledgerTimestamp: 'asc' }, select: { id: true, receiptHash: true, encryptedVote: true } }),
      prisma.ledgerEntry.findMany({ where: { electionId }, orderBy: { timestamp: 'asc' } }),
      prisma.electionFinalization.findUnique({ where: { electionId } }),
    ]);

    const bundle = {
      version: 'election-audit-bundle-1',
      election: {
        id: election.id,
        name: election.name,
        signingPublicKey: election.signingPublicKey,
        merkleRoot: election.merkleRoot,
      },
      ballots: votes.map(v => ({ id: v.id, receiptHash: v.receiptHash, encryptedVote: v.encryptedVote })),
      ledgerEntries: ledgerEntries.map(e => ({
        entryType: e.entryType,
        data: e.data,
        dataHash: e.dataHash,
        previousEntryHash: e.previousEntryHash,
        signature: e.signature,
        signerPublicKey: e.signerPublicKey,
        timestamp: e.timestamp.toISOString(),
      })),
      ...(finalization
        ? {
            finalization: {
              electionId: finalization.electionId,
              configurationHash: finalization.configurationHash,
              eligibilityRoot: finalization.eligibilityRoot || null,
              finalBallotRoot: finalization.finalBallotRoot || null,
              ledgerRoot: finalization.ledgerRoot,
              ballotCount: finalization.ballotCount,
              finalizationTimestamp: finalization.finalizationTimestamp.toISOString(),
              manifestHash: finalization.manifestHash,
              signature: finalization.signature,
              signerPublicKey: finalization.signerPublicKey,
              otsProofBase64: finalization.otsProofBase64 || null,
            },
          }
        : {}),
    };

    return res.json(bundle);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
