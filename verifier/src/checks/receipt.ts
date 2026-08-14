/**
 * Check 6: a single voter receipt's Merkle inclusion proof, checkable from
 * just the proof and a trusted root - no server trust, no full ballot set
 * required. This is the check a lone voter runs to confirm their own vote
 * was counted.
 *
 * The proof's own `root` field is never trusted on its own - a malicious
 * server could hand back a proof that's internally consistent but built
 * against a fabricated root. `expectedRoot` must come from an
 * independently-verified source (the signed finalization manifest's
 * finalBallotRoot, itself checked by checkFinalizationSignature).
 */

import { hashLeaf, recomputeMerkleRoot } from '../crypto/merkle';
import type { RemoteMerkleProof } from '../client';
import { fail, pass, CheckResult } from './types';

export function checkReceiptInclusion(
  proof: RemoteMerkleProof,
  expectedRoot: string,
  rawCiphertext?: string
): CheckResult {
  const issues: string[] = [];

  if (rawCiphertext) {
    const expectedLeaf = hashLeaf(rawCiphertext);
    if (expectedLeaf !== proof.leaf) {
      issues.push('the supplied ciphertext does not hash to the proof\'s leaf - this proof is not for the ballot you submitted');
    }
  }

  const recomputedRoot = recomputeMerkleRoot(proof);
  if (recomputedRoot !== proof.root) {
    issues.push('recomputing the proof\'s own sibling path does not reproduce its claimed root - the proof itself is internally inconsistent');
  }
  if (proof.root !== expectedRoot) {
    issues.push('the proof\'s root does not match the independently-verified signed finalBallotRoot - this proof was not built against the real, final ballot set');
  }

  if (issues.length > 0) {
    return fail(
      'receipt-inclusion',
      'Voter receipt inclusion',
      'This receipt does not prove inclusion under the trusted root.',
      issues,
      { index: proof.index }
    );
  }

  return pass(
    'receipt-inclusion',
    'Voter receipt inclusion',
    rawCiphertext
      ? 'Your ballot ciphertext, its Merkle proof, and the signed final root all agree - this vote was counted.'
      : 'This receipt\'s Merkle proof recomputes to the signed final root - the referenced ballot was counted.',
    { index: proof.index, root: proof.root }
  );
}
