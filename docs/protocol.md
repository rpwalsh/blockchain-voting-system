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

**Signatures:** as of Milestone 5, the `CERTIFY` action
(`backend/src/routes/election-approvals.ts`) requires `>=` threshold distinct admins
to each submit a real Ed25519 signature over the proposal hash before the
`DRAFT` → `REGISTRATION` transition executes — a real M-of-N gate, not a single
officer key.

**Failure conditions:** attempting to certify with zero candidates (for
candidate-based elections), an empty eligibility set, or a start date in the past.

**Implementation status:** the multi-party approval gate on the status transition is
real (Milestone 5). Field-level immutability enforcement after certification
(rejecting a direct write to candidates/dates/keys once past `DRAFT`) is not yet
implemented — a determined direct-DB-write attacker could still mutate a
"certified" election's configuration outside the approval flow; this is a known gap,
not silently assumed solved.

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

**Implementation status:** real as of Milestone 1 (`POST
/api/elections/:electionId/voters/register`, `backend/src/routes/ballot.ts`), checked
against a real electorate snapshot. This issued token now only authenticates the
*next* stage (eligibility credential enrollment) — it is not used to vote directly
as of Milestone 2; see "Credential issuance" below.

---

## Stage: Credential issuance

**Inputs:** a registered voter (identified via the registration flow below) and a
secret they generate client-side.

**Outputs:** an `EligibilityCommitment` leaf — `commitment = Poseidon(secret, salt)`,
`salt` deterministically derived from `secret` — added to the election's eligibility
Merkle tree (20 levels, `circuits/eligibility.circom`). The server never sees `secret`,
only `commitment`.

**Cryptographic commitments:** `election.eligibilityRoot` is republished after each
enrollment/revocation.

**Failure conditions:** caller's token hash does not match a registered voter;
election not in `DRAFT`/`REGISTRATION` (the tree must be stable once voting opens);
commitment already enrolled.

**Implementation status:** real as of Milestone 2 (`backend/src/routes/eligibility.ts`,
`backend/circuits/eligibility.circom`). Enrollment is still identified (the caller
authenticates via their registration token hash) — the anonymity property is that
*voting*, the next stage, never correlates a ballot back to which enrolled commitment
produced it, not that enrollment itself is anonymous. That's the real
identity/eligibility/credential/ballot separation this stage exists for: an identified
enrollment step feeding an anonymous voting step.

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

**Inputs:** the encrypted ballot, a Groth16 proof of eligibility (Merkle membership
in `election.eligibilityRoot`, `circuits/eligibility.circom`).

**Outputs:** a `Vote` record: encrypted vote, homomorphic tally ciphertexts
(one EC ElGamal encryption per candidate, one-hot — see "Stage: Tally"), `voteProof`,
`receiptHash`, `ledgerEntryHash`, Merkle root at time of inclusion, Merkle proof.

**State transition:** the proof's nullifier (`Poseidon(secret, electionId)`, a public
circuit output) moves from `unspent` to `spent` — enforced by a unique constraint on
`(electionId, nullifier)`, checked *without the server ever looking up which enrolled
credential this is*. This is what makes double-vote prevention anonymity-preserving:
the old design looked up "voter by token" before verifying anything, so the server
always knew who was voting regardless of any proof.

**Cryptographic commitments:** the vote is appended to the append-only ledger
(`LedgerEntry`, `entryType: 'VOTE_CAST'`) and to the running Merkle tree over all
ballot ciphertexts cast so far.

**Signatures:** the ledger entry is signed (`signerPublicKey`/`signature` fields on
`LedgerEntry`) by the election's signing key.

**Failure conditions:** nullifier already spent (double-vote, `P2002` on the unique
constraint); eligibility proof does not verify or is checked against a stale root;
election not in `VOTING` status; `candidateId` not a real candidate for this election.

**Implementation status:** real and enforced as of Milestones 1-2
(`backend/src/routes/ballot.ts`). Honest remaining gap: `candidateId` is still stored
in the clear on the `Vote` row alongside the homomorphic ciphertext — the *published,
certified* tally comes entirely from the ciphertext path (see "Stage: Tally"), but
full ballot secrecy from a database-level adversary would require removing the
plaintext field too, tracked as a follow-up hardening item rather than silently
assumed done.

---

## Stage: Ballot validation

Covered inline above (candidate-set membership, proof verification, credential-spend
check). The privacy-preserving version — proving `candidate ∈ validSet` inside a ZK
circuit without revealing which candidate — is Milestone 3 scope
(`generateVoteValidityProof` today always returns the fiat-shamir fallback, honestly
labeled `protocol: 'fiat-shamir-fallback'`, because no `vote-validity` circuit has
been compiled; see `docs/cryptography.md`).

## Stage: Duplicate prevention

Nullifier-based as of Milestone 2: each eligibility proof outputs
`nullifier = Poseidon(secret, electionId)`, deterministic per credential per
election (so a double-vote attempt reuses the same nullifier and collides) and
unlinkable across elections (different `electionId` → unrelated nullifier). The
`Nullifier` table's `(electionId, nullifier)` unique constraint is checked inside the
same transaction that records the vote, so a race between two concurrent double-vote
attempts fails atomically rather than both succeeding. This is real, anonymity-
preserving double-vote prevention, not identity-based deduplication.

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

**Implementation status:** the ballot endpoint enforces `election.status === 'VOTING'`
on every vote (Milestone 1) and finalization requires the same status to transition to
`COMPLETED` (Milestone 1/5's `FINALIZE` approval action) - so votes stop being
accepted the moment finalization runs. There is no separate enforced `endDate` cutoff
independent of an explicit close/finalize action: an election whose `endDate` has
passed but hasn't been finalized will still accept votes. Real gap, not yet closed.

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

**Target:** `publishedResult = correctFunction(all committed ballots)`, independently
verifiable without trusting the server's arithmetic. **Real as of Milestone 3**
(`backend/src/crypto/tally.ts`, `backend/src/routes/tally.ts`): exponential
(lifted) EC ElGamal over secp256k1. Each ballot carries one ciphertext per candidate,
one-hot at the voter's choice; ciphertexts are summed homomorphically (EC point
addition) across all ballots; the sum is threshold-decrypted by combining
`tallyThreshold`-many trustees' partial decryptions via Lagrange interpolation in the
exponent — no party, including the server, ever reconstructs the tally private key.
Each partial decryption carries a Chaum-Pedersen NIZK proof that it was computed
honestly from the trustee's committed share, checkable by anyone.

`GET /:electionId/tally/verify` independently re-derives the result from scratch:
recomputes the ciphertext sum from live ballots (not trusting the stored sum),
re-checks every partial-decryption proof against the trustees' real published
commitments (`election.tallyKeyShares`, not commitments embedded in the same
tamper-checked bundle), and re-solves the bounded discrete log.

**Honest remaining gap:** trustee shares are generated and stored server-side at
election creation (same centralized-custody gap as the signing key — see
`docs/threat-model.md`, "Colluding trustees"). What's real: no plaintext tally key is
ever persisted, and the published result is independently checkable regardless of who
custodies the shares today.

## Stage: Result certification

Uses the same multi-party threshold-signature mechanism as other critical actions
(Milestone 5, `backend/src/routes/election-approvals.ts`): a `TALLY` proposal
requires `>=` threshold distinct admins to each submit a real Ed25519 signature over
the proposal hash before `computeTally()` runs. One admin cannot certify a result
alone.

## Stage: Recount

**Real as of Milestone 5** (`POST /:electionId/recount`,
`backend/src/routes/operations.ts`): independently regenerates everything from
scratch rather than touching cached totals — walks the full ledger chain and
verifies every entry's hash/signature, rebuilds the ballot Merkle tree from live
ciphertexts, and (if a tally exists) re-derives each candidate's count via a fresh
threshold decryption. Flags any mismatch rather than assuming stored values are
correct. The independent verifier CLI (Milestone 4, `verifier/`) provides the same
guarantee from outside the server entirely, given an audit export bundle.

## Stage: Audit

The append-only `LedgerEntry` log is real, hash-chained (`@@unique([electionId,
previousEntryHash])` blocks concurrent writers from forking the chain), Ed25519-signed
per entry, and independently reconstructible: `crypto-audit.ts`'s integrity checks and
`operations.ts`'s recount both actually walk `previousEntryHash` and recompute
`dataHash`/signatures rather than asserting validity. `GET /:electionId/observer/status`
exposes real-time aggregate integrity signals (ledger depth, current Merkle root, vote
count, finalization/anchor status) publicly, with no voter- or ballot-content data.
`GET /:electionId/audit-export` packages a full bundle in the exact shape the
Milestone 4 verifier CLI's `--bundle` mode consumes.

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

**Implementation status:** unified as of Milestone 1 — `election-player.ts POST
/:electionId/verify-vote` reconstructs a real Merkle proof and checks it against
`ElectionFinalization.finalBallotRoot` once finalized (else the live
`election.merkleRoot`), per "Finalization" above. The Milestone 4 verifier CLI
(`verifier/`) provides the same check from entirely outside the server.
