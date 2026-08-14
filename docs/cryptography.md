# Cryptography Reference

Status: **draft, v0.1**. `GET /api/crypto-audit/capabilities` and
`GET /api/crypto-audit/algorithms` make no compliance or certification claims
(no FIPS 140-2 Level 2+, Common Criteria EAL4+, SOC 2 Type II, or ISO 27001 -
**none of those are backed by an actual audit, certificate, or validated
module**). Using NIST-recommended/approved *algorithms* (true, see below) is
not the same thing as holding a *certification*, which requires an actual
validation process this project has not gone through. If that process ever
happens, this document is where the real certificate/report would be linked.

## What's real vs. fallback, per primitive

| Primitive | Real implementation | Fallback / not yet real |
|---|---|---|
| Ed25519 signatures | `generateKeyPair`, `signData`, `verifySignature` — tweetnacl | — |
| Election keypair (NaCl box) | `generateElectionKeyPair` | — |
| Vote encryption | `encryptVote`/`decryptVote` — Curve25519-XSalsa20-Poly1305, authenticated | Does not yet bind `electionId`/ballot-definition into the plaintext payload (see `docs/protocol.md`, "Ballot encryption") |
| SHA3-256/512 hashing | `hashVotingToken`, `createReceiptHash`, etc. | Domain-separated — see below |
| PBKDF2 identity hashing | `createIdentityHash` — 210,000 iterations, SHA-512, matches the OWASP 2024 recommendation cited in the code | — |
| Merkle tree | `MerkleTree` — real SHA3-256 tree, `getProof`/`verifyProof` | Leaf/internal-node domain separation (avoids the RFC 6962-style second-preimage weakness); odd-level nodes are promoted rather than duplicated (avoids the CVE-2012-2459-class issue) |
| Shamir secret sharing | `splitSecretShamir`/`reconstructSecretShamir` — real GF(256) polynomial interpolation, not a stub | Project-written, not an externally vetted library (the code's own comment says "PRODUCTION: Use secrets.js-grempe or @stablelib/secret-sharing" — that has not been done; treat this as functionally real but not independently audited) |
| Groth16 zk-SNARK, `token_validity` circuit | Real: compiled circuit, real trusted-setup artifacts under `backend/circuits/build/`, real `snarkjs.groth16.fullProve`/`verify` — see `backend/circuits/README.md` | The trusted setup is a single-contributor local ceremony, explicitly documented as insufficient for a real election (see that README's "Production trusted setup" section) |
| Groth16 zk-SNARK, `vote-validity` (ballot validity without revealing choice) | — | Not implemented. No circuit has been written/compiled. `generateVoteValidityProof` always returns the `fiat-shamir-fallback` protocol, which is a commitment, not a zero-knowledge proof of anything, and is labeled as such in its own `protocol` field specifically so it can't be mistaken for a real proof |
| Tally correctness proof | — | Not implemented. `TallyResult.proof` is a schema field with no code path that populates it with an actual proof |
| External timestamp anchor | `submitTimestampAnchor`/`checkTimestampAnchor` — real OpenTimestamps submission to independent calendar servers | The older `generateBlockchainAnchor()` is still present for backward compatibility and is honestly labeled `real: false` — it was pure local simulation (`blockNumber: 0`, a locally-computed digest, no external network call). See "On the external timestamp anchor" below |

## Domain separation

Prior to Milestone 1, hashes across the codebase reused the same bare `sha3_256`
with no domain tag, meaning a hash computed for one purpose (e.g. a voting-token
hash) is, as a bit string, indistinguishable from a hash computed for an unrelated
purpose (e.g. a Merkle leaf) if the same input happened to be fed to both. That's
the precondition for a cross-protocol confusion attack. Milestone 1 introduces
explicit domain tags, implemented in `backend/src/crypto/canonical.ts`:

```
H("ELECTION-ID", ...)
H("ELECTION-CONFIG", ...)
H("ELECTION-ELIGIBILITY", ...)
H("ELECTION-CREDENTIAL", ...)
H("ELECTION-NULLIFIER", ...)
H("ELECTION-BALLOT", ...)
H("ELECTION-RECEIPT", ...)
H("ELECTION-MERKLE-LEAF", ...)
H("ELECTION-MERKLE-NODE", ...)
H("ELECTION-FINALIZE", ...)
H("ELECTION-TALLY", ...)
```

Each is `sha3_256(tag + "\x00" + canonicalize(payload))` — the tag is
length-implicitly separated from the payload by a null byte so that
`H("A", "BC")` and `H("AB", "C")` cannot collide by tag/payload boundary
confusion.

## On the external timestamp anchor

This is worth being precise about, because "blockchain voting system" is the
project's name, and the word "blockchain" carries an implicit claim worth
separating into two distinct things.

**The project's own blockchain is `LedgerEntry` + the Merkle tree** — a private,
self-contained, hash-chained, signed append-only ledger that belongs entirely to
this system (see `docs/protocol.md`, "Stage: Audit" and "Stage: Ballot inclusion").
That is what makes an election's record tamper-evident, and it does not depend on
anything outside this codebase.

**Separately**, per `docs/trust-model.md`, there is an optional external
**timestamp anchor** for the finalization manifest: a notary, not a security
mechanism. `crypto.submitTimestampAnchor()` / `checkTimestampAnchor()`
(`backend/src/crypto/engine.ts`) submit the manifest hash to OpenTimestamps, a
real, free, independent timestamping service. This gives an outside witness that
the election's final commitment existed at a certain time - useful, but not
required for the system's core integrity guarantees, which come entirely from the
project's own ledger and signatures.

**No financial transaction, wallet, token, or monetary value is involved anywhere
in this.** OpenTimestamps uses a public, append-only timestamp ledger purely as an
external clock - the same idea as a notary stamping a document, or publishing a
hash in a newspaper, to prove it existed by a certain date. This project never
holds funds, never spends anything, and nothing about a vote is monetized or
tokenized. This distinction matters enough to spell out explicitly, since a
reviewer skimming code that mentions an external public ledger could otherwise
mistake it for a currency or payment feature, which it is not and was never
intended to be.

Before this was wired up for real, `generateBlockchainAnchor()` (still present,
now honestly labeled `real: false`) was pure local simulation - it returned
`blockNumber: 0` with a comment admitting `// Placeholder - needs web3
integration` and a `transactionHash` that was just `sha3_256(merkleRoot +
Date.now())` computed on this server, never touching anything external. That was
exactly the kind of claim this document exists to prevent. `submitTimestampAnchor`
replaces it with something that actually does what it claims: real network
submission to a real, independent timestamping service, with an honestly
asynchronous confirmation state rather than a faked-instant one.

## PBKDF2 for identity hashing

`createIdentityHash(voterId, salt)` uses PBKDF2 (210,000 iterations, SHA-512) rather
than a fast domain-separated hash. This is a deliberate choice, not an
inconsistency with the fast-hash approach used elsewhere: `voterId` in some
deployments (e.g. an SSN-like identifier, a union member ID) may come from a
relatively small, guessable space, unlike a 32-byte random voting token. PBKDF2's
deliberate slowness is what makes offline brute-force correlation of a leaked
`identityHash` back to a real identifier expensive. Everything else that gets
hashed in this system (tokens, ballots, commitments) is either already high-entropy
or is a public commitment where slowness provides no benefit — those correctly use
the fast, domain-separated SHA3-256 construction instead.

## What "Groth16" actually buys the `token_validity` proof

The circuit (`backend/circuits/token_validity.circom`) proves: knowledge of a
`tokenPreimage` and `salt` whose salted Poseidon hash equals a public
`tokenHashCommitment`, and outputs a `nullifier` = `Poseidon(tokenPreimage, challengeHash)`
bound to a server-issued freshness challenge. The verifier learns "this caller knows
a token matching a commitment I already have on file, for this specific challenge"
— never the token itself. This is genuinely zero-knowledge for that one property.
It is **not**, on its own, a proof of ballot validity, tally correctness, or
election integrity — those are separate, currently-unimplemented circuits (Milestone
3). Overstating what one working circuit proves about the rest of the system is
exactly the kind of claim this document exists to prevent.
