/**
 * Check 4: walk the ledger's previousEntryHash chain and verify each
 * entry's dataHash and signature independently, mirroring the intent of
 * crypto-audit.ts's "Ledger Chain Integrity" check but run here instead of
 * trusting that endpoint to have run it honestly. Entries must be supplied
 * in ascending chain order (oldest first) - the same order
 * backend/src/utils/audit.ts writes them and finalization.ts reads them.
 */

import { DOMAIN, domainHash } from '../crypto/canonical';
import { verifyEd25519 } from '../crypto/signature';
import type { BundleLedgerEntry } from '../bundle';
import { fail, pass, skip, CheckResult } from './types';

export function checkLedgerChain(electionId: string, entries: BundleLedgerEntry[] | undefined): CheckResult {
  if (!entries) {
    return skip(
      'ledger-chain',
      'Ledger chain integrity',
      'No ledger entries available (requires --bundle with a "ledgerEntries" array; no public API endpoint exposes the full ledger).'
    );
  }
  if (entries.length === 0) {
    return pass('ledger-chain', 'Ledger chain integrity', 'No ledger entries recorded yet - nothing to check.', { entriesChecked: 0 });
  }

  const issues: string[] = [];
  let previousDataHash: string | null = null;
  let previousTimestamp: string | undefined;

  entries.forEach((entry, i) => {
    const expectedDataHash = domainHash(DOMAIN.ELECTION_LEDGER, {
      electionId,
      entryType: entry.entryType,
      data: entry.data,
      previousEntryHash: previousDataHash,
    });

    if (expectedDataHash !== entry.dataHash) {
      issues.push(`entry ${i} (${entry.entryType}): dataHash does not match recomputation`);
    }
    if ((entry.previousEntryHash ?? null) !== previousDataHash) {
      issues.push(`entry ${i} (${entry.entryType}): previousEntryHash does not chain to entry ${i - 1}'s dataHash`);
    }
    if (!verifyEd25519(entry.dataHash, entry.signature, entry.signerPublicKey)) {
      issues.push(`entry ${i} (${entry.entryType}): signature does not verify against signerPublicKey`);
    }
    if (entry.timestamp && previousTimestamp && entry.timestamp <= previousTimestamp) {
      issues.push(`entry ${i} (${entry.entryType}): timestamp does not strictly increase over entry ${i - 1}`);
    }

    previousDataHash = entry.dataHash;
    previousTimestamp = entry.timestamp ?? previousTimestamp;
  });

  if (issues.length > 0) {
    return fail(
      'ledger-chain',
      'Ledger chain integrity',
      `${issues.length} issue(s) found across ${entries.length} ledger entries.`,
      issues,
      { entriesChecked: entries.length }
    );
  }

  return pass(
    'ledger-chain',
    'Ledger chain integrity',
    `All ${entries.length} ledger entries chain correctly and are validly signed.`,
    { entriesChecked: entries.length }
  );
}
