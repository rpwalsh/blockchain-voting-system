/**
 * Check 2: rebuild the Merkle tree from the raw ballot ciphertext set and
 * confirm the root matches what the election reports. Requires the actual
 * ballot list (bundle mode only - see README, "Why a bundle mode exists");
 * live API mode has no public endpoint that returns raw ciphertexts, so
 * this check is SKIPped there rather than silently passed.
 */

import { MerkleTree } from '../crypto/merkle';
import type { BundleBallot } from '../bundle';
import { fail, pass, skip, warn, CheckResult } from './types';

export function checkMerkleRoot(
  ballots: BundleBallot[] | undefined,
  finalBallotRoot: string | null | undefined,
  liveElectionRoot: string | null | undefined
): CheckResult {
  if (!ballots || ballots.length === 0) {
    return skip(
      'merkle-root',
      'Merkle tree reconstruction',
      'No ballot ciphertext list available (requires --bundle with a "ballots" array in ledger order; no public API endpoint exposes raw ballot ciphertexts).'
    );
  }

  const expectedRoot = finalBallotRoot || liveElectionRoot;
  if (!expectedRoot) {
    return skip('merkle-root', 'Merkle tree reconstruction', 'No finalized or live Merkle root available to compare against.');
  }

  const tree = new MerkleTree(ballots.map(b => b.encryptedVote));
  const recomputedRoot = tree.getRoot();
  const matches = recomputedRoot === expectedRoot;

  const usingSignedRoot = !!finalBallotRoot;
  const baseDetail = usingSignedRoot
    ? 'Root recomputed from ballots matches the signed finalization\'s finalBallotRoot.'
    : 'Root recomputed from ballots matches the live (unsigned, mutable) election.merkleRoot - this election has not been finalized yet, so this root is not yet immutable.';

  if (!matches) {
    return fail(
      'merkle-root',
      'Merkle tree reconstruction',
      `Root recomputed from ${ballots.length} ballots does NOT match the reported root - the ballot set or its order has been altered since the root was reported.`,
      [`expected ${expectedRoot}`, `recomputed ${recomputedRoot}`],
      { ballotCount: ballots.length }
    );
  }

  const result = usingSignedRoot
    ? pass('merkle-root', 'Merkle tree reconstruction', baseDetail, { ballotCount: ballots.length, root: recomputedRoot })
    : warn('merkle-root', 'Merkle tree reconstruction', baseDetail, { ballotCount: ballots.length, root: recomputedRoot });
  return result;
}
