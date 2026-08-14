/**
 * Offline audit bundle: the "locally exported JSON bundle" input mode.
 * Everything needed for a full offline run (all six checks) that the
 * backend's *public, unauthenticated* HTTP endpoints don't expose in one
 * shot today - in particular, no live endpoint returns the raw set of
 * ballot ciphertexts or the full ledger entry list without org
 * authentication (see README, "Why a bundle mode exists"). Producing a
 * bundle is out of scope for this tool; it only consumes one.
 */

import { readFileSync } from 'fs';

export interface BundleBallot {
  id?: string;
  receiptHash?: string;
  encryptedVote: string;
}

export interface BundleLedgerEntry {
  entryType: string;
  data: string;
  dataHash: string;
  previousEntryHash: string | null;
  signature: string;
  signerPublicKey: string;
  timestamp?: string;
}

export interface BundleFinalization {
  electionId: string;
  configurationHash: string;
  eligibilityRoot: string | null;
  finalBallotRoot: string | null;
  ledgerRoot: string | null;
  ballotCount: number;
  finalizationTimestamp: string;
  manifestHash: string;
  signature: string;
  signerPublicKey: string;
  otsProofBase64?: string | null;
}

export interface AuditBundle {
  version: string;
  election: {
    id: string;
    name?: string;
    signingPublicKey?: string;
    merkleRoot?: string | null;
  };
  ballots?: BundleBallot[];
  ledgerEntries?: BundleLedgerEntry[];
  finalization?: BundleFinalization;
}

const SUPPORTED_VERSIONS = new Set(['election-audit-bundle-1']);

export function loadBundle(path: string): AuditBundle {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (error: any) {
    throw new Error(`Could not read bundle file '${path}': ${error.message}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (error: any) {
    throw new Error(`Bundle file '${path}' is not valid JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Bundle file '${path}' must contain a JSON object`);
  }
  if (!SUPPORTED_VERSIONS.has(parsed.version)) {
    throw new Error(
      `Bundle file '${path}' has version '${parsed.version}' - this verifier supports: ${[...SUPPORTED_VERSIONS].join(', ')}`
    );
  }
  if (!parsed.election?.id) {
    throw new Error(`Bundle file '${path}' is missing election.id`);
  }

  return parsed as AuditBundle;
}
