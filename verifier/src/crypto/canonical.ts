/**
 * Canonical serialization and domain-separated hashing, reimplemented
 * standalone from the protocol spec (docs/protocol.md, docs/cryptography.md)
 * rather than imported from the backend. An independent verifier that
 * imports the code it's supposed to be checking can't catch a bug or a
 * deliberate tamper in that code - it would just reproduce it. This file
 * must stay byte-for-byte compatible with backend/src/crypto/canonical.ts
 * without ever requiring it.
 */

import { sha3_256 } from 'js-sha3';

export const DOMAIN = {
  ELECTION_ID: 'ELECTION-ID',
  ELECTION_CONFIG: 'ELECTION-CONFIG',
  ELECTION_ELIGIBILITY: 'ELECTION-ELIGIBILITY',
  ELECTION_CREDENTIAL: 'ELECTION-CREDENTIAL',
  ELECTION_NULLIFIER: 'ELECTION-NULLIFIER',
  ELECTION_BALLOT: 'ELECTION-BALLOT',
  ELECTION_RECEIPT: 'ELECTION-RECEIPT',
  ELECTION_MERKLE_LEAF: 'ELECTION-MERKLE-LEAF',
  ELECTION_MERKLE_NODE: 'ELECTION-MERKLE-NODE',
  ELECTION_FINALIZE: 'ELECTION-FINALIZE',
  ELECTION_TALLY: 'ELECTION-TALLY',
  ELECTION_LEDGER: 'ELECTION-LEDGER',
  ELECTION_ADMIN_ACTION: 'ELECTION-ADMIN-ACTION',
  ELECTION_AUDIT_EXPORT: 'ELECTION-AUDIT-EXPORT',
} as const;

export type DomainTag = (typeof DOMAIN)[keyof typeof DOMAIN];

function sortValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortValue);
  if (value instanceof Date) return value.toISOString();

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const v = sortValue((value as Record<string, unknown>)[key]);
    if (v !== undefined) sorted[key] = v;
  }
  return sorted;
}

/**
 * Deterministic JSON: sorted object keys (recursively), array order
 * preserved, undefined-valued keys dropped. Two independent producers of
 * the "same" logical object must produce identical bytes here.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/** sha3_256(tag || 0x00 || canonicalize(payload)) */
export function domainHash(tag: DomainTag, payload: unknown): string {
  return sha3_256(tag + '\x00' + canonicalize(payload));
}

/** sha3_256(tag || 0x00 || raw) for non-JSON payloads (e.g. Merkle leaves). */
export function domainHashRaw(tag: DomainTag, raw: string): string {
  return sha3_256(tag + '\x00' + raw);
}
