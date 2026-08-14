/**
 * Check 5 (optional): external OpenTimestamps anchor. Uses the same
 * independent `opentimestamps` client library the backend uses (a
 * standard, third-party OTS client - not backend code) to deserialize the
 * .ots proof, confirm it actually anchors *this* manifest hash (not just
 * that it's a well-formed proof for something), and check whether the
 * public timestamp calendar servers have confirmed it yet. See
 * docs/cryptography.md, "On the external timestamp anchor" - this is a
 * notary, not a security mechanism, so an unconfirmed-but-locally-valid
 * anchor is a WARN, not a FAIL.
 */

import { createHash } from 'crypto';
import { fail, pass, skip, warn, CheckResult } from './types';

// @ts-ignore - opentimestamps ships incomplete/mismatched TS definitions
const OpenTimestamps = require('opentimestamps');

export interface TimestampCheckOptions {
  /** Skip the network round-trip to the OTS calendar servers; only checks the local digest binding. */
  skipNetwork?: boolean;
}

export async function checkTimestampAnchor(
  manifestHash: string,
  otsProofBase64: string | null | undefined,
  options: TimestampCheckOptions = {}
): Promise<CheckResult> {
  if (!otsProofBase64) {
    return skip('timestamp-anchor', 'External timestamp anchor', 'No OpenTimestamps proof was submitted for this manifest (optional feature - see docs/trust-model.md).');
  }

  let detached: any;
  try {
    const proofBytes = Buffer.from(otsProofBase64, 'base64');
    detached = OpenTimestamps.DetachedTimestampFile.deserialize(proofBytes);
  } catch (error: any) {
    return fail('timestamp-anchor', 'External timestamp anchor', `Could not parse the .ots proof: ${error.message}`);
  }

  const hashOpName: string = detached.fileHashOp._HASHLIB_NAME();
  const actualDigestHex: string = OpenTimestamps.Utils.bytesToHex(detached.fileDigest());
  const expectedDigestHex = createHash('sha256').update(manifestHash).digest('hex');

  if (hashOpName !== 'sha256') {
    return fail('timestamp-anchor', 'External timestamp anchor', `Proof is tagged as ${hashOpName}, not sha256 - cannot correspond to this manifest.`);
  }
  if (actualDigestHex !== expectedDigestHex) {
    return fail(
      'timestamp-anchor',
      'External timestamp anchor',
      'The proof does not anchor this manifest hash - it is a valid OTS proof for a different digest entirely.',
      [`expected sha256(manifestHash) = ${expectedDigestHex}`, `proof anchors ${actualDigestHex}`]
    );
  }

  if (options.skipNetwork) {
    return warn(
      'timestamp-anchor',
      'External timestamp anchor',
      'Proof correctly anchors this manifest hash. Network confirmation against the public OTS calendar servers was skipped (--skip-timestamp).'
    );
  }

  try {
    await OpenTimestamps.upgrade(detached);
    const info: string = OpenTimestamps.info(detached);
    const confirmed = /BlockHeaderAttestation/i.test(info) || /attests/i.test(info);

    if (confirmed) {
      return pass(
        'timestamp-anchor',
        'External timestamp anchor',
        'Proof anchors this manifest hash and is confirmed by the public OpenTimestamps ledger.'
      );
    }
    return warn(
      'timestamp-anchor',
      'External timestamp anchor',
      'Proof correctly anchors this manifest hash but is not yet confirmed by the public ledger - normal for anchors submitted recently (confirmation typically takes hours).'
    );
  } catch (error: any) {
    return warn(
      'timestamp-anchor',
      'External timestamp anchor',
      `Proof correctly anchors this manifest hash locally; could not reach the OpenTimestamps calendar servers to check confirmation status (${error.message}).`
    );
  }
}
