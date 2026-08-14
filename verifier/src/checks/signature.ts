/**
 * Check 3: finalization manifest signature. Verifying Ed25519(manifestHash)
 * against `finalization.signerPublicKey` only proves the manifest is
 * self-consistent with whatever key it names - it does NOT prove that key
 * belongs to this election. A malicious server can mint a fresh keypair,
 * sign a fabricated manifest with it, and pass a signature check against
 * itself trivially. The binding to "the election's real key" has to come
 * from outside this tool (published by the election authority, pinned in
 * a bundle the caller trusts, etc) - see README, "Trusting a signing key".
 * When the caller supplies `expectedSigningKey`, this check enforces that
 * binding; when they don't, it still verifies the signature but downgrades
 * to WARN so the gap isn't silently reported as a clean PASS.
 */

import { verifyEd25519 } from '../crypto/signature';
import type { BundleFinalization } from '../bundle';
import { fail, pass, warn, CheckResult } from './types';

export function checkFinalizationSignature(
  finalization: BundleFinalization,
  expectedSigningKey?: string
): CheckResult {
  const sigValid = verifyEd25519(finalization.manifestHash, finalization.signature, finalization.signerPublicKey);

  if (!sigValid) {
    return fail(
      'finalization-signature',
      'Finalization manifest signature',
      'Ed25519 signature over manifestHash does not verify against the claimed signerPublicKey.',
      [`signerPublicKey: ${finalization.signerPublicKey}`]
    );
  }

  if (!expectedSigningKey) {
    return warn(
      'finalization-signature',
      'Finalization manifest signature',
      'Signature verifies against the manifest\'s own claimed signerPublicKey, but no --signing-key was supplied to confirm that key actually belongs to this election. Pass --signing-key <base64> (obtained out-of-band, not from this server) for a real trust result.',
      { signerPublicKey: finalization.signerPublicKey }
    );
  }

  if (finalization.signerPublicKey !== expectedSigningKey) {
    return fail(
      'finalization-signature',
      'Finalization manifest signature',
      'The manifest is signed by a key that does not match the expected election signing key - the signature is internally valid but was made by the wrong key.',
      [`expected ${expectedSigningKey}`, `got ${finalization.signerPublicKey}`]
    );
  }

  return pass(
    'finalization-signature',
    'Finalization manifest signature',
    'Ed25519 signature verifies against the expected election signing key.',
    { signerPublicKey: finalization.signerPublicKey }
  );
}
