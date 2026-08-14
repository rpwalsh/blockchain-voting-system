/**
 * Canonical serialization and domain-separated hashing.
 *
 * See docs/protocol.md ("Canonical serialization") and docs/cryptography.md
 * ("Domain separation") for the rationale. Nothing in the election protocol
 * should be hashed or signed without going through canonicalize()/domainHash()
 * first - a bare JSON.stringify() is not safe to sign, because key order in a
 * JS object literal is insertion order, not a stable canonical order, and two
 * honest producers of the "same" logical object can disagree on it.
 */

import { sha3_256 } from 'js-sha3';

/**
 * Domain tags for every hash site in the election protocol. Each tag names
 * exactly one purpose; the same bit string hashed under two different tags
 * can never collide by construction (see domainHash), which is what
 * prevents a hash computed for one purpose from being replayed as if it
 * were a hash computed for a different purpose.
 */
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

/**
 * Recursively sort object keys, drop undefined-valued keys, and produce a
 * stable JSON string. Arrays keep their given order (order is semantically
 * significant for arrays; it is not for object keys).
 */
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
 * Canonicalize an arbitrary JSON-serializable value into a deterministic
 * byte string. Same logical object -> same bytes, regardless of key
 * insertion order or incidental whitespace.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/**
 * Domain-separated hash: sha3_256(tag || 0x00 || canonicalize(payload)).
 * The null byte between tag and payload prevents tag/payload boundary
 * confusion (H("A","BC") cannot be made to collide with H("AB","C")).
 */
export function domainHash(tag: DomainTag, payload: unknown): string {
  return sha3_256(tag + '\x00' + canonicalize(payload));
}

/**
 * Domain-separated hash of raw bytes/strings that aren't a JSON payload
 * (e.g. hashing a single opaque token string). Still tag-prefixed for the
 * same reason as domainHash.
 */
export function domainHashRaw(tag: DomainTag, raw: string): string {
  return sha3_256(tag + '\x00' + raw);
}
