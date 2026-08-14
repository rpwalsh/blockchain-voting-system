/**
 * Check 1: manifest hash self-consistency. Recomputes
 * H("ELECTION-FINALIZE", canon(manifest)) from the finalization record's
 * own fields and confirms it equals the record's claimed manifestHash -
 * exactly what backend/src/routes/finalization.ts's GET handler does, but
 * without trusting that handler to have actually done it.
 */

import { DOMAIN, domainHash } from '../crypto/canonical';
import type { BundleFinalization } from '../bundle';
import { fail, pass, CheckResult } from './types';

export function checkManifestHash(finalization: BundleFinalization): CheckResult {
  const manifest = {
    electionId: finalization.electionId,
    configurationHash: finalization.configurationHash,
    eligibilityRoot: finalization.eligibilityRoot || null,
    finalBallotRoot: finalization.finalBallotRoot || null,
    ledgerRoot: finalization.ledgerRoot,
    ballotCount: finalization.ballotCount,
    finalizationTimestamp: finalization.finalizationTimestamp,
  };

  const recomputed = domainHash(DOMAIN.ELECTION_FINALIZE, manifest);
  const matches = recomputed === finalization.manifestHash;

  if (!matches) {
    return fail(
      'manifest-hash',
      'Finalization manifest hash',
      'The claimed manifestHash does not match H("ELECTION-FINALIZE", canon(manifest)) recomputed from the manifest\'s own fields - the manifest has been altered, or its hash was never real.',
      [`expected ${recomputed}`, `got ${finalization.manifestHash}`]
    );
  }

  return pass(
    'manifest-hash',
    'Finalization manifest hash',
    'manifestHash matches an independent recomputation from the manifest fields.',
    { manifestHash: finalization.manifestHash }
  );
}
