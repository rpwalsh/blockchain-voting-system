# Election Protocol Specification

Status: **draft, v0.1**. This document is the specification. The implementation must
conform to it — not the other way around. Where the current codebase does not yet
implement a stage as specified, that is called out explicitly under **Implementation
status** rather than left ambiguous.

This document defines the protocol independent of any particular deployment. It does
not describe the multi-tenant governance/SaaS layer (organizations, billing, RBAC,
SSO) — see `docs/trust-model.md` for how that layer relates to the protocol below.

## Conventions

- `H(x)` denotes a domain-separated hash — see `docs/cryptography.md` for the exact
  domain tags. A bare, non-domain-separated hash must never be used for anything that
  is signed, committed to, or compared across contexts.
- `Sig(k, m)` denotes an Ed25519 signature over `m` under private key `k`.
- `canon(x)` denotes canonical serialization of `x` — see "Canonical serialization"
  below. Nothing is hashed or signed without first being canonicalized.
- Every stage below states **Inputs**, **Outputs**, **State transition**,
  **Cryptographic commitments**, **Signatures**, and **Failure conditions**, per the
  project's own design goal of not letting the implementation remain the
  specification.

## Canonical serialization

Before any object is hashed or signed, it must be reduced to a canonical byte string.
Two semantically identical objects (same fields, same values, different key order or
different JSON whitespace) must produce the **same** canonical bytes.

Rule: canonical form is JSON with object keys sorted lexicographically (recursively,
including nested objects), no insignificant whitespace, UTF-8 encoding, numbers
serialized without leading zeros or trailing `.0`, and no `undefined`-valued keys
(omit them entirely rather than serializing `null` unless `null` is the actual
semantic value). Arrays preserve their given order — order is significant and is not
sorted.

Implemented in `backend/src/crypto/canonical.ts` (`canonicalize(obj): string`). Every
hash or signature site in the protocol must call `canonicalize()` first. See
`docs/cryptography.md` for why: signing a language-default `JSON.stringify()` output
is not safe, because key order in JS object literals is insertion order, not a stable
canonical order, and two producers of the "same" object can legitimately disagree on
it.

## Election lifecycle (state machine)

```
DRAFT → CERTIFIED → OPEN → CLOSED → TALLYING → CERTIFIED_RESULT
```

Once an election leaves `DRAFT`, its `ConfigurationHash` (see below) is immutable.
Any change to candidates, ballot definition, eligibility rules, or cryptographic
parameters after certification requires creating a **new** election version with a
new `ElectionID` — never a silent mutation of the existing one.

**Implementation status:** the current `Election.status` field in
`backend/prisma/schema.prisma` uses a different, looser set of string values
(`DRAFT|REGISTRATION|VOTING|TALLYING|COMPLETED|CANCELLED|DISPUTED`) with no enforced
transition rules or immutability guarantee — any field can be updated at any status
via a direct Prisma write. There is currently no code path that freezes configuration
at open, and no "new version required" mechanism. This is a known gap; see Milestone
1 backlog.

## Election identity

Every election has a stable cryptographic identity derived from its canonicalized
configuration:

```
ElectionID = H("ELECTION-ID", canon({
  protocolVersion,
  organizationId,
  name, type, category,
  startDate, endDate,
  candidateList,          // canonicalized candidate set, order-significant
  ballotDefinitionHash,   // see Ballot construction
  eligibilityRoot,        // see Voter enrollment
  electionPublicKey,
  creationTimestamp,
}))
```

Every subsequent artifact (votes, receipts, ledger entries, tally, result) references
this `ElectionID`. This prevents two different configurations from being confused
with each other, and lets any artifact be checked against the specific election it
claims to belong to.

**Implementation status:** not implemented. The current `Election.id` is a random
UUID assigned by the database (`@default(uuid())`), unrelated to the election's
content. Milestone 1 adds a `ConfigurationHash`/manifest as described under
"Finalization" below, computed at certification time; a content-derived `ElectionID`
that changes the primary key scheme is a larger migration deferred past Milestone 1.

---

## Stage: Election creation

**Inputs:** organization ID, election name/description/type/category, start/end
dates, candidate list (optional at creation for some ballot types), eligibility rule
reference.

**Outputs:** an `Election` row in `DRAFT` status, a freshly generated election
keypair (`crypto.generateElectionKeyPair()` — Curve25519, real), an
`ElectorateSnapshot` capturing exactly which members are eligible *at creation time*
and the rule that produced that set.

**State transition:** (none) → `DRAFT`.

**Cryptographic commitments:** `ElectorateSnapshot.snapshotHash` = `H("ELECTION-ELIGIBILITY", canon({rule, memberExternalIds}))`.
This is real today (`backend/src/routes/governance.ts`, `POST /api/governance/elections`)
but uses `crypto.hashVotingToken()` (bare SHA3-256, no domain tag) rather than a
domain-separated hash — Milestone 1 fixes the domain separation.

**Signatures:** none currently. The election manifest should be signed by the
creating election officer's key once multi-party administration exists (Milestone
5).

**Failure conditions:** missing required fields → 400. No candidate list is *not* a
failure at creation (some governance vote types add candidates later, before
opening) but **must** be a failure at certification (see below).

---

## Stage: Election configuration / certification

**Inputs:** a `DRAFT` election plus its candidate list and eligibility snapshot.

**Outputs:** a signed election manifest (see "Finalization" section — the same
mechanism is used at open-time certification and at close-time finalization, applied
to different fields) and a `ConfigurationHash` covering everything that must not
change again.

**State transition:** `DRAFT` → `CERTIFIED` → `OPEN`.

After this transition: candidate list, ballot definition, eligibility rules,
cryptographic parameters, and the election keypair are frozen. Any administrative
change requires a new `ElectionID`.

**Cryptographic commitments:** `ConfigurationHash = H("ELECTION-CONFIG", canon(electionManifest))`.

**Signatures:** `Sig(officerKey, ConfigurationHash)`, and once Milestone 5's
multi-party administration lands, an M-of-N threshold signature rather than a single
officer key.

**Failure conditions:** attempting to certify with zero candidates (for
candidate-based elections), an empty eligibility set, or a start date in the past.

**Implementation status:** not implemented — there is currently no explicit
certification step or immutability enforcement between `DRAFT` and later statuses.
This is Milestone 1 scope.

---

## Stage: Voter enrollment

**Inputs:** the electorate snapshot from creation, plus (in the current
implementation) each voter's registration request.

**Outputs:** a `Voter` row per eligible participant: `identityHash` (PBKDF2-SHA512,
210,000 iterations — real, see `crypto.createIdentityHash`), `votingTokenHash`
(SHA3-256 of a 32-byte random token — real), `registrationProof`.

**State transition:** none at the election level; each `Voter` transitions
`registered` → `voted` (via `Voter.hasVoted`).

**Cryptographic commitments:** `votingTokenHash` commits the server to a specific
token without storing the token itself; `computeTokenCommitment()` (real Poseidon
hash over BN254) is the commitment actually consumed by the ZK layer in the next
stage.

**Failure conditions:** voter not in the electorate snapshot; voter already
registered (`@@unique([electionId, identityHash])` enforces this at the DB level).

**Implementation status:** the primitives are real and exercised in tests
(`backend/src/__tests__/crypto/engine-zk-paths.test.ts`), but there is no live HTTP
endpoint that performs voter enrollment against a real electorate snapshot outside of
seed scripts. Building that endpoint is Milestone 1 scope; binding enrollment to
*anonymous* credentials rather than a directly-issued token is Milestone 2 scope (see
"Credential issuance is probably the biggest missing protocol" in the design
backlog).

---

## Stage: Credential issuance

Specified for Milestone 2. Today, "credential" and "voting token" are the same
bearer secret (`crypto.generateVotingToken()`), which the election server itself
issues and can therefore correlate with the registration record it came from — the
system does not yet have the identity/eligibility/credential/ballot separation the
design backlog calls for. Milestone 2 replaces this with an anonymous credential
scheme (eligibility proof issued by a registration authority, consumed without
correlation by the voting protocol).

---

## Stage: Ballot construction

**Inputs:** a candidate selection (or ranked/approval selection depending on ballot
type) from a voter holding a valid, unspent credential.

**Outputs:** a plaintext ballot object: `{ candidateId, electionId, ballotDefinitionHash, nonce, timestamp }`.

Binding `electionId` and `ballotDefinitionHash` into the plaintext (not just relying
on which key encrypted it) is what makes a ciphertext non-transferable between
elections even in the event of key reuse — see `docs/cryptography.md`.

**Failure conditions:** `candidateId` not in the election's certified candidate list
for the ballot type in question (single-select / multi-select / ranked) — this is the
"prove ballot validity without revealing the vote" requirement; today this check
happens in plaintext server-side (see next stage), not inside a ZK circuit, so it is
not yet a *privacy-preserving* validity proof.

---

## Stage: Ballot encryption

**Inputs:** the plaintext ballot object, the election's public key.

**Outputs:** `EncryptedVote { ciphertext, nonce, ephemeralPublicKey, version, algorithm, timestamp }`
via NaCl box (Curve25519-XSalsa20-Poly1305) — real, `crypto.encryptVote()`.

**Cryptographic commitments:** the plaintext payload includes an `integrity` field
(`sha3_256(candidateId)`) checked on decrypt, and a timestamp bounds-checked to
reject implausibly old ciphertexts on decrypt.

**Failure conditions:** encryption under a stale/wrong election public key is
currently undetectable by the recipient except indirectly (decryption still
succeeds, since NaCl box only authenticates against the keypair used, not against
which *election* that keypair belongs to) — this is the gap that election-binding in
ballot construction (previous stage) closes: the decrypted plaintext itself asserts
which election it belongs to, so a mismatch is now checkable even if the encryption
key were somehow shared or reused.

---

## Stage: Ballot submission

**Inputs:** the encrypted ballot, the voter's credential/proof of eligibility, a
freshness challenge from the server.

**Outputs:** a `Vote` record: encrypted vote, `voteProof`, `receiptHash`,
`ledgerEntryHash`, Merkle root at time of inclusion, Merkle proof.

**State transition:** credential moves from `unspent` to `spent` for this election
(enforced today by `Voter.hasVoted` / `votingTokenHash` uniqueness; enforced in the
target design by nullifier uniqueness — see Milestone 2).

**Cryptographic commitments:** the vote is appended to the append-only ledger
(`LedgerEntry`, `entryType: 'VOTE_CAST'`) and to the running Merkle tree over all
votes cast so far.

**Signatures:** the ledger entry is signed (`signerPublicKey`/`signature` fields
exist on `LedgerEntry`) by the entity that accepted the ballot.

**Failure conditions:** credential already spent (double-vote); malformed
ciphertext; proof does not verify; election not in `OPEN` status; ballot definition
hash mismatch.

**Implementation status: this stage does not currently exist as a live endpoint.**
This is the single most important gap identified in this repository's Milestone 1
audit: every `Vote` row in the database today was written directly by a seed script
(`backend/src/scripts/seed-demo.ts`, `seed-production.ts`), not accepted through an
HTTP API that enforces credential-spend checks, proof verification, or ledger
signing. The cryptographic *primitives* needed to build this endpoint correctly are
real and tested in isolation; the endpoint that composes them into an enforced
protocol is Milestone 1 work. See `docs/threat-model.md`, "malicious voter" and
"compromised server" categories, for why this matters.

---

## Stage: Ballot validation

Covered inline above (candidate-set membership, proof verification, credential-spend
check). The privacy-preserving version — proving `candidate ∈ validSet` inside a ZK
circuit without revealing which candidate — is Milestone 3 scope
(`generateVoteValidityProof` today always returns the fiat-shamir fallback, honestly
labeled `protocol: 'fiat-shamir-fallback'`, because no `vote-validity` circuit has
been compiled; see `docs/cryptography.md`).

## Stage: Duplicate prevention

Today: `Voter.votingTokenHash` is `@unique` and `Voter.hasVoted` is checked
server-side. This prevents the *same registered voter row* from voting twice, but
because the voting token is a bearer credential the server itself issued and can
trace back to the voter record, it does not yet provide the anonymity-preserving
double-vote prevention the design targets (nullifier-based, unlinkable to identity).
That upgrade is Milestone 2.

## Stage: Ballot inclusion

A voter (or auditor) proves a specific ballot is included in the finalized ledger via
a Merkle inclusion proof against the **final, signed** root (not "whatever the
database currently contains" — see Finalization). `MerkleTree`/`MerkleTree.verifyProof`
are real (`backend/src/crypto/engine.ts`, domain tags in
`backend/src/crypto/canonical.ts`):

1. Leaf and internal-node hashing use different domain tags
   (`sha3_256(leaf-tag + leaf)` vs `sha3_256(node-tag + left + right)`), preventing
   the classic Merkle second-preimage weakness (RFC 6962 exists specifically to
   prevent this by prefixing leaves and internal nodes with different domain tags).
2. Odd-node levels promote the last node unchanged to the next level rather than
   duplicating it as its own sibling, preventing the CVE-2012-2459-class
   duplicate-node issue.

## Stage: Election closure

**Inputs:** current time ≥ `endDate`, or an authorized close action.

**Outputs:** election moves to `CLOSED`; no further ballot submissions accepted.

**State transition:** `OPEN` → `CLOSED`.

**Implementation status:** not implemented as an enforced transition — nothing
currently prevents a `Vote` from being written against an election whose `endDate`
has passed, because (per above) there is no ballot-submission endpoint enforcing
status at all yet. Building the ballot endpoint (Milestone 1) includes this check
from day one.

## Stage: Finalization

At close, exactly one authoritative finalization event occurs:

```
stop accepting ballots
→ freeze ballot ledger
→ compute final Merkle root over all included ballots
→ compute FinalizationManifest = canon({
    electionId, configurationHash, eligibilityRoot,
    finalBallotRoot, ledgerRoot, ballotCount, finalizationTimestamp
  })
→ ManifestHash = H("ELECTION-FINALIZE", FinalizationManifest)
→ Sig(officerKey, ManifestHash)
```

The signed manifest is the artifact that makes the final root **immutable** — a
receipt's Merkle proof must be checked against *this* root, not against whatever
`Election.merkleRoot` happens to read at verification time (which, absent this
manifest, is just a mutable database column an operator could rewrite).

**Implementation status:** implemented as of Milestone 1
(`backend/src/routes/finalization.ts`, `ElectionFinalization` model). Before
Milestone 1, `Election.merkleRoot` was a plain mutable column with no signature and
no "this is final" event — this is exactly the "a server shouldn't be able to say
'here is the final Merkle root' and control the only copy" problem called out in the
design backlog. Milestone 1 does not yet externalize the manifest outside this
election server's own database (no independent transparency log, no blockchain
anchor beyond the existing simulated one — see `docs/cryptography.md` for why the
current `generateBlockchainAnchor()` is not a real anchor) — that is Milestone 5/the
"externalize the final commitment" backlog item.

## Stage: Tally

**Target:** an architecture where `publishedResult = correctFunction(all committed
ballots)` is independently verifiable — homomorphic tally, mixnet, or
threshold-decryption-of-aggregate (design backlog item 11). **Not implemented.**
`TallyResult.proof` exists as a schema field described as "ZK proof tally is
correct" but nothing in the codebase populates it with a real proof; this comment is
corrected as part of Milestone 1's "remove security theater" pass, and the actual
cryptographic tally is Milestone 3 scope.

Today, tallying (where it happens at all, e.g. in `election-player.ts`'s stats
endpoint) is a plaintext count over `Vote` rows grouped by `candidateId` — which
requires the reader to trust the database, not a cryptographic proof.

## Stage: Result certification

Specified to require the same threshold-signature mechanism as finalization, applied
to the tally output. Not implemented; depends on Milestone 3 (real tally) existing
first.

## Stage: Recount

**Target:** `election-verifier recount <election-package>` independently
regenerates the tally from the same finalized artifacts without touching the
original election state; a mismatch between original and recount result is a
protocol failure, not something the server explains away. Not implemented —
Milestone 5, and depends on Milestone 4's independent verifier existing.

## Stage: Audit

The append-only `LedgerEntry` log is real as a data model and is populated for vote
casts via seed scripts today. It is not yet independently reconstructible/verifiable
end-to-end (the "Ledger Chain Integrity" check in `crypto-audit.ts` currently
hardcodes `chainValid = true` without checking `previousEntryHash` at all — fixed
under Milestone 1; see `docs/threat-model.md`).

## Stage: Receipt verification

**Target artifact:**

```
ElectionReceipt {
  protocolVersion,
  electionId,
  ballotCommitment,     // not the plaintext vote
  merkleRoot,            // the FINAL, signed root, not a live/mutable one
  merkleProof,
  receiptNonce,
  authoritySignature,
}
```

Proves *inclusion*, never *choice*. Not an NFT, not a bearer-transferable proof of
how someone voted — see `docs/threat-model.md`, "coercer" category, for why that
distinction is load-bearing rather than a style preference.

**Implementation status:** two different, inconsistent verification code paths exist
today (`governance.ts POST /verifier/receipt` reconstructs a real Merkle proof;
`election-player.ts POST /:electionId/verify-vote` only compares
`vote.merkleRoot === vote.election.merkleRoot` without checking the proof path at
all). Milestone 1 unifies these into one real verifier and adds the signed-manifest
root as the thing actually checked against, per "Finalization" above.
