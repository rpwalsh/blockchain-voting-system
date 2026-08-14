/**
 * Cryptographic tally - see docs/protocol.md "Stage: Tally" and
 * crypto/tally.ts. Homomorphically sums each candidate's EC ElGamal
 * ciphertexts across all cast ballots, threshold-decrypts the sum by
 * combining >= tallyThreshold trustee partial decryptions (each with a
 * Chaum-Pedersen proof), and publishes the full bundle so the result is
 * independently verifiable without trusting this server's arithmetic.
 *
 * Honest scope note: trustee shares are generated and stored server-side
 * at election creation (see routes/governance.ts, routes/superadmin.ts) -
 * the same centralized-custody gap documented for the signing key in
 * docs/threat-model.md, "Colluding trustees". What's real here: no
 * plaintext tally private key is ever persisted, decryption only happens
 * by combining threshold-many independently-verifiable partial
 * decryptions, and the published result includes everything needed for a
 * third party to recompute and check it from scratch.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import tally, { ElGamalCiphertext, TallyKeyShare } from '../crypto/tally';

const router = Router();

interface TallyProofBundle {
  summedCiphertext: ElGamalCiphertext;
  partialDecryptions: ReturnType<typeof tally.computePartialDecryption>[];
  trusteePublicCommitments: { index: number; publicCommitment: TallyKeyShare['publicCommitment'] }[];
  threshold: number;
}

/**
 * POST /api/elections/:electionId/tally/compute
 * Computes and certifies the real cryptographic tally. Authorization for
 * this action (who may trigger it, multi-party sign-off) is Milestone 5
 * scope - this endpoint implements the cryptography, not the operational
 * access control around it.
 */
router.post('/:electionId/tally/compute', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, error: 'Election not found' });
    if (!['VOTING', 'TALLYING', 'COMPLETED'].includes(election.status)) {
      return res.status(409).json({ success: false, error: `Election status ${election.status} is not eligible for tallying` });
    }
    if (!election.tallyPublicKey || !election.tallyKeyShares || !election.tallyThreshold) {
      return res.status(500).json({ success: false, error: 'Election has no tally keypair configured' });
    }

    const existing = await prisma.tallyResult.findMany({ where: { electionId } });
    if (existing.length > 0) {
      return res.json({ success: true, alreadyTallied: true, results: existing });
    }

    const candidates = await prisma.candidate.findMany({ where: { electionId }, orderBy: { order: 'asc' } });
    if (candidates.length === 0) {
      return res.status(409).json({ success: false, error: 'Election has no candidates' });
    }

    const votes = await prisma.vote.findMany({ where: { electionId }, select: { tallyCiphertexts: true } });
    const totalBallots = votes.length;
    if (totalBallots === 0) {
      return res.status(409).json({ success: false, error: 'No ballots cast yet' });
    }

    const shares: TallyKeyShare[] = JSON.parse(election.tallyKeyShares);
    const threshold = election.tallyThreshold;
    const trustees = shares.slice(0, threshold);

    const results: any[] = [];
    let totalDecrypted = 0;

    for (const candidate of candidates) {
      const ciphertexts: ElGamalCiphertext[] = votes
        .map(v => {
          const parsed = v.tallyCiphertexts ? JSON.parse(v.tallyCiphertexts) : null;
          const entry = parsed?.find((c: any) => c.candidateId === candidate.id);
          return entry?.ciphertext as ElGamalCiphertext | undefined;
        })
        .filter((c): c is ElGamalCiphertext => !!c);

      if (ciphertexts.length !== totalBallots) {
        return res.status(500).json({
          success: false,
          error: `Ballot ${candidate.id} is missing a tally ciphertext - cannot certify a partial tally`,
        });
      }

      const summedCiphertext = tally.homomorphicSum(ciphertexts);
      const partialDecryptions = trustees.map(share => tally.computePartialDecryption(share, summedCiphertext));

      for (const partial of partialDecryptions) {
        const trustee = trustees.find(t => t.index === partial.index)!;
        if (!tally.verifyPartialDecryption(trustee.publicCommitment, summedCiphertext, partial)) {
          return res.status(500).json({ success: false, error: `Partial decryption from trustee ${partial.index} failed self-verification` });
        }
      }

      const combined = tally.combinePartialDecryptions(partialDecryptions);
      const voteCount = tally.decryptSum(summedCiphertext, combined, totalBallots);

      const bundle: TallyProofBundle = {
        summedCiphertext,
        partialDecryptions,
        trusteePublicCommitments: trustees.map(t => ({ index: t.index, publicCommitment: t.publicCommitment })),
        threshold,
      };

      results.push({ candidateId: candidate.id, candidateName: candidate.name, voteCount, bundle });
      totalDecrypted += voteCount;
    }

    // Sanity check: a one-hot encoding means every candidate's decrypted
    // count summed across candidates must equal the total ballot count -
    // if it doesn't, something is wrong with the ciphertexts or the
    // decryption, and publishing the result would be dishonest.
    if (totalDecrypted !== totalBallots) {
      return res.status(500).json({
        success: false,
        error: `Decrypted tally (${totalDecrypted}) does not match total ballots (${totalBallots}) - refusing to certify`,
      });
    }

    const created = await prisma.$transaction(
      results.map(r =>
        prisma.tallyResult.create({
          data: {
            electionId,
            candidateId: r.candidateId,
            voteCount: r.voteCount,
            percentage: totalBallots > 0 ? (r.voteCount / totalBallots) * 100 : 0,
            proof: JSON.stringify(r.bundle),
            merkleRoot: election.merkleRoot || '',
          },
        })
      )
    );

    return res.status(201).json({
      success: true,
      totalBallots,
      results: created.map(r => ({ candidateId: r.candidateId, voteCount: r.voteCount, percentage: r.percentage })),
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/elections/:electionId/tally/verify
 * Independently re-verifies a published tally from scratch: recomputes the
 * homomorphic sum from live ballots, re-checks every partial decryption's
 * Chaum-Pedersen proof, re-combines them, and confirms the result matches
 * what was certified. Does not trust the stored voteCount at all.
 */
router.get('/:electionId/tally/verify', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election?.tallyKeyShares) {
      return res.status(500).json({ success: false, error: 'Election has no tally keypair configured' });
    }
    // Trustee public commitments come from the election record, not from
    // the tally bundle being checked - verifying a bundle's proofs against
    // publicCommitments embedded in that same bundle would let a DB-level
    // attacker forge a self-consistent fake trustee alongside a fake
    // partial decryption and pass verification.
    const realShares: TallyKeyShare[] = JSON.parse(election.tallyKeyShares);

    const results = await prisma.tallyResult.findMany({ where: { electionId } });
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'No tally has been computed for this election' });
    }

    const votes = await prisma.vote.findMany({ where: { electionId }, select: { tallyCiphertexts: true } });
    const totalBallots = votes.length;

    // A real independent verifier must handle corrupted/adversarial stored
    // data (e.g. a tampered point that isn't even on the curve) by
    // reporting a clean verification failure, not crashing - each result
    // is checked in isolation so one malformed bundle can't 500 the whole
    // response.
    const checks = results.map(r => {
      try {
        const bundle: TallyProofBundle = JSON.parse(r.proof);

        const ciphertexts: ElGamalCiphertext[] = votes
          .map(v => {
            const parsed = v.tallyCiphertexts ? JSON.parse(v.tallyCiphertexts) : null;
            const entry = parsed?.find((c: any) => c.candidateId === r.candidateId);
            return entry?.ciphertext as ElGamalCiphertext | undefined;
          })
          .filter((c): c is ElGamalCiphertext => !!c);

        const recomputedSum = tally.homomorphicSum(ciphertexts);
        const sumMatches =
          JSON.stringify(recomputedSum) === JSON.stringify(bundle.summedCiphertext);

        const proofsValid = bundle.partialDecryptions.every(partial => {
          try {
            const trustee = realShares.find(t => t.index === partial.index);
            return !!trustee && tally.verifyPartialDecryption(trustee.publicCommitment, bundle.summedCiphertext, partial);
          } catch {
            return false;
          }
        });

        let recomputedCount = -1;
        let countMatches = false;
        try {
          const combined = tally.combinePartialDecryptions(bundle.partialDecryptions);
          recomputedCount = tally.decryptSum(bundle.summedCiphertext, combined, totalBallots);
          countMatches = recomputedCount === r.voteCount;
        } catch {
          // leave recomputedCount/countMatches at their failure defaults
        }

        return {
          candidateId: r.candidateId,
          certifiedVoteCount: r.voteCount,
          recomputedVoteCount: recomputedCount,
          checks: { ciphertextSumMatches: sumMatches, partialDecryptionProofsValid: proofsValid, decryptedCountMatches: countMatches },
          verified: sumMatches && proofsValid && countMatches,
        };
      } catch {
        return {
          candidateId: r.candidateId,
          certifiedVoteCount: r.voteCount,
          recomputedVoteCount: -1,
          checks: { ciphertextSumMatches: false, partialDecryptionProofsValid: false, decryptedCountMatches: false },
          verified: false,
        };
      }
    });

    return res.json({ success: true, totalBallots, results: checks, allVerified: checks.every(c => c.verified) });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
