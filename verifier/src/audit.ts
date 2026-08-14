/**
 * Orchestrates the individual checks (src/checks/*) into the two supported
 * run modes: an offline JSON bundle, or the backend's live public
 * endpoints via ElectionApiClient. Neither mode touches Prisma or the
 * backend's database.
 */

import type { AuditBundle } from './bundle';
import { ElectionApiClient } from './client';
import { checkManifestHash } from './checks/manifest';
import { checkFinalizationSignature } from './checks/signature';
import { checkMerkleRoot } from './checks/merkleRoot';
import { checkLedgerChain } from './checks/ledgerChain';
import { checkTimestampAnchor } from './checks/timestampAnchor';
import { checkReceiptInclusion } from './checks/receipt';
import { MerkleTree } from './crypto/merkle';
import { CheckResult, fail, skip } from './checks/types';

export interface AuditOptions {
  /** Trust anchor for the finalization signature - must come from the operator, never from the data being audited. */
  expectedSigningKey?: string;
  receiptHash?: string;
  ciphertext?: string;
  skipTimestamp?: boolean;
}

export async function auditBundle(bundle: AuditBundle, options: AuditOptions): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const finalization = bundle.finalization ?? null;

  if (!finalization) {
    results.push(fail('manifest-hash', 'Finalization manifest hash', 'Bundle has no "finalization" section - this election has not been finalized, or the bundle is incomplete.'));
    results.push(skip('finalization-signature', 'Finalization manifest signature', 'No finalization manifest to check.'));
    results.push(skip('timestamp-anchor', 'External timestamp anchor', 'No finalization manifest to anchor.'));
  } else {
    results.push(checkManifestHash(finalization));
    results.push(checkFinalizationSignature(finalization, options.expectedSigningKey));
    results.push(await checkTimestampAnchor(finalization.manifestHash, finalization.otsProofBase64, { skipNetwork: options.skipTimestamp }));
  }

  results.push(checkMerkleRoot(bundle.ballots, finalization?.finalBallotRoot ?? null, bundle.election.merkleRoot ?? null));
  results.push(checkLedgerChain(bundle.election.id, bundle.ledgerEntries));

  if (options.receiptHash) {
    results.push(receiptFromBundle(bundle, options.receiptHash, options.ciphertext));
  }

  return results;
}

function receiptFromBundle(bundle: AuditBundle, receiptHash: string, ciphertext?: string): CheckResult {
  if (!bundle.ballots || bundle.ballots.length === 0) {
    return skip('receipt-inclusion', 'Voter receipt inclusion', 'Bundle has no "ballots" array to look up this receipt in.');
  }
  const index = bundle.ballots.findIndex(b => b.receiptHash === receiptHash);
  if (index < 0) {
    return fail('receipt-inclusion', 'Voter receipt inclusion', `No ballot with receiptHash ${receiptHash} found in this bundle.`);
  }
  const expectedRoot = bundle.finalization?.finalBallotRoot || bundle.election.merkleRoot;
  if (!expectedRoot) {
    return skip('receipt-inclusion', 'Voter receipt inclusion', 'No finalized or live Merkle root available to check this receipt against.');
  }
  const tree = new MerkleTree(bundle.ballots.map(b => b.encryptedVote));
  const proof = tree.getProof(index);
  return checkReceiptInclusion(proof, expectedRoot, ciphertext);
}

export async function auditApi(client: ElectionApiClient, electionId: string, options: AuditOptions): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  let finalization;
  try {
    finalization = await client.getFinalization(electionId);
  } catch (error: any) {
    results.push(fail('manifest-hash', 'Finalization manifest hash', error.message));
    results.push(skip('finalization-signature', 'Finalization manifest signature', 'Could not fetch finalization manifest.'));
    results.push(skip('timestamp-anchor', 'External timestamp anchor', 'Could not fetch finalization manifest.'));
    results.push(checkMerkleRoot(undefined, null, null));
    results.push(checkLedgerChain(electionId, undefined));
    if (options.receiptHash) results.push(skip('receipt-inclusion', 'Voter receipt inclusion', 'Could not fetch finalization manifest.'));
    return results;
  }

  results.push(checkManifestHash(finalization));
  results.push(checkFinalizationSignature(finalization, options.expectedSigningKey));
  results.push(await checkTimestampAnchor(finalization.manifestHash, finalization.otsProofBase64, { skipNetwork: options.skipTimestamp }));
  results.push(checkMerkleRoot(undefined, null, null));
  results.push(checkLedgerChain(electionId, undefined));

  if (options.receiptHash) {
    try {
      const { proof } = await client.verifyVote(electionId, options.receiptHash);
      if (!finalization.finalBallotRoot) {
        results.push(skip('receipt-inclusion', 'Voter receipt inclusion', 'Election has no signed finalBallotRoot yet.'));
      } else {
        results.push(checkReceiptInclusion(proof, finalization.finalBallotRoot, options.ciphertext));
      }
    } catch (error: any) {
      results.push(fail('receipt-inclusion', 'Voter receipt inclusion', error.message));
    }
  }

  return results;
}

/**
 * The "a voter checks their own vote" flow (item 6): just the manifest
 * signature and one receipt's inclusion proof, without the full-ledger
 * checks that only an election-wide auditor needs. Works from a bundle or
 * live from the public API - either way, only cryptography is trusted.
 */
export async function verifyReceiptBundle(bundle: AuditBundle, receiptHash: string, options: AuditOptions): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  if (!bundle.finalization) {
    results.push(fail('manifest-hash', 'Finalization manifest hash', 'Bundle has no "finalization" section.'));
    return results;
  }
  results.push(checkManifestHash(bundle.finalization));
  results.push(checkFinalizationSignature(bundle.finalization, options.expectedSigningKey));
  results.push(receiptFromBundle(bundle, receiptHash, options.ciphertext));
  return results;
}

export async function verifyReceiptApi(
  client: ElectionApiClient,
  electionId: string,
  receiptHash: string,
  options: AuditOptions
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  let finalization;
  try {
    finalization = await client.getFinalization(electionId);
  } catch (error: any) {
    results.push(fail('manifest-hash', 'Finalization manifest hash', error.message));
    return results;
  }

  results.push(checkManifestHash(finalization));
  results.push(checkFinalizationSignature(finalization, options.expectedSigningKey));

  try {
    const { proof } = await client.verifyVote(electionId, receiptHash);
    if (!finalization.finalBallotRoot) {
      results.push(skip('receipt-inclusion', 'Voter receipt inclusion', 'Election has no signed finalBallotRoot yet.'));
    } else {
      results.push(checkReceiptInclusion(proof, finalization.finalBallotRoot, options.ciphertext));
    }
  } catch (error: any) {
    results.push(fail('receipt-inclusion', 'Voter receipt inclusion', error.message));
  }

  return results;
}
