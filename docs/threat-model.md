# Threat Model

Status: **draft, v0.1**. Companion to `docs/protocol.md` and `docs/trust-model.md`.
Each adversary category below is mapped to concrete mitigations, and each mitigation
is marked implemented or not — this document is a specification and an honest audit,
not a marketing sheet. The design principle: **assume every individual component
except the cryptographic assumptions themselves is malicious, and ask what still
holds.**

## Malicious voter

| Attack | Mitigation | Status |
|---|---|---|
| Duplicate voting | `Voter.votingTokenHash` uniqueness + `hasVoted` check; target: nullifier uniqueness (unlinkable to identity) | Token-uniqueness only; nullifier scheme is Milestone 2 |
| Malformed ballot/proof | Server-side ballot definition + candidate-set check; target: ZK ballot-validity circuit | Plaintext server check only; no ballot-casting endpoint exists yet to enforce even that (Milestone 1) |
| Replay of a captured proof | Domain-separated challenge binding (`generateTokenValidityProof` binds a freshness challenge; nullifier differs per challenge — verified in `engine-zk-paths.test.ts`) | Implemented for token-validity proofs specifically |
| Credential theft | Anonymous, non-bearer credential scheme | Not implemented — current token is a bearer secret (Milestone 2) |

## Malicious election administrator

| Attack | Mitigation | Status |
|---|---|---|
| Alter configuration after voting opens | Immutable `ConfigurationHash` + signed manifest at certification | Not implemented (Milestone 1 backlog item) |
| Suppress specific ballots | Append-only signed ledger; voter-held receipts prove submission independent of server cooperation | Ledger model exists; ballot-casting endpoint that actually appends+signs does not (Milestone 1) |
| Alter results after tally | Threshold signature on result certification; independent recount | Not implemented (Milestone 3/5) |
| Fabricate ballots | Every ballot requires a valid credential/proof the admin does not control; nullifier set is append-only and externally auditable | Not implemented — no enforcement point exists yet |
| Rewrite the "final" Merkle root | Signed `ElectionFinalization` manifest, checked instead of the live mutable `Election.merkleRoot` column | Implemented in Milestone 1 |

A single admin account (or a stolen admin session) should never be sufficient, on
its own, to open, close, or certify an election — see "Multi-party administration"
in `docs/trust-model.md`. That is not yet enforced; today `requireOrgRole(['ORG_ADMIN', ...])`
gates these actions on a single authenticated session.

## Compromised election server / database

The central question this project's cryptography exists to answer: **if the server
and database are fully compromised (data read AND write access), what can still be
detected, and by whom, without the server's cooperation?**

| Attack | Mitigation | Status |
|---|---|---|
| Silently modify a stored ballot | Merkle-inclusion receipts held by voters, checkable against the *signed* final root, not the live DB | Merkle primitives real; signed final root is Milestone 1; receipts don't yet reference it |
| Delete a ballot | Same — a missing leaf changes the root, which no longer matches the voter's receipt or the signed manifest | Same status |
| Reorder/forge ledger entries | Hash-chained ledger (`previousEntryHash`) + signatures, independently reconstructible | `crypto-audit.ts` "Ledger Chain Integrity" walks the chain and computes `chainValid` from the actual entries |
| Substitute the tally result | Tally proof, independently verifiable without trusting the server that computed it | Not implemented (Milestone 3) — `TallyResult.proof` field exists but nothing populates it |
| Report false "integrity check" status to auditors | Every check must derive its `PASS`/`FAIL` from an actual computed condition, never a literal | `crypto-audit.ts` derives every check's status from a computed condition |

## Colluding trustees / key holders

| Attack | Mitigation | Status |
|---|---|---|
| Threshold compromise (K trustees collude) | Shamir K-of-N split of election private key (currently 3-of-5); document what happens below K vs at/above K | Shamir split/reconstruct is real (`splitSecretShamir`/`reconstructSecretShamir`, GF(256) polynomial + Lagrange interpolation) — see `docs/cryptography.md` for the caveat that this is a project-written implementation, not an externally vetted library |
| Premature decryption before close | Trustees should not be able to combine shares before finalization; enforce procedurally + log every reconstruction attempt | Not enforced in code today — `reconstructSecretShamir` is callable at any time by anything holding ≥3 shares |

## Malicious/compromised voting client

The hardest practical problem in the whole system: a client can display "you voted
for Alice" while submitting a ballot for Bob. The server-side cryptography cannot
fix a client the voter does not trust.

| Mitigation | Status |
|---|---|
| Ballot confirmation / cast-as-intended verification before final submission | Not implemented |
| Independent client implementations able to construct the same canonical ballot | Not implemented (canonical serialization itself is Milestone 1 — a prerequisite) |
| Signed, reproducible client releases | Not implemented |

This category is flagged rather than "solved" — see the design backlog's own framing
that this deserves its own section rather than a false claim of resolution.

## Network attacker

| Attack | Mitigation | Status |
|---|---|---|
| Replay a captured ballot submission | Freshness challenge bound into the proof (`generateChallenge` + challenge-bound nullifier) | Implemented for token-validity proofs |
| MITM | TLS termination (deployment concern, not application-layer) + `helmet()` headers | Standard Express hardening present (`backend/src/index.ts`) |
| Denial of service | Rate limiting (`express-rate-limit`, `config.rateLimitWindowMs`/`rateLimitMaxRequests`) | Present, coarse-grained (global, not per-endpoint-sensitive) |

## Supply-chain attacker

| Attack | Mitigation | Status |
|---|---|---|
| Compromised dependency | Lockfile pinning (`package-lock.json`) | Present; no reproducible-build attestation |
| Malicious build output | Deterministic build + published artifact hash/signature | Not implemented |

## Coercer

Can a voter *prove* to a third party how they voted? If yes, vote-buying and
coercion become possible even with perfect ballot secrecy from the server's
perspective.

| Requirement | Status |
|---|---|
| Receipts prove inclusion, never choice | By design in `docs/protocol.md`'s `ElectionReceipt`; not yet enforced end-to-end since the ballot-casting endpoint that would issue such receipts doesn't exist yet |
| Receipts are not bearer-transferable public proof of participation (explicitly: **not an NFT**) | Design decision, documented; nothing in the current codebase mints anything on-chain per vote, so there is no existing anti-pattern to remove here — this is a constraint on future work, not a current bug |
| Re-vote / last-vote-counted semantics to blunt in-person coercion | Not specified yet — depends on the election model (some governance elections may deliberately disallow re-voting; a general answer is deferred pending which deployment this targets) |

## What this document is not

It is not a claim that the system has passed external security review, penetration
testing, or any compliance certification. See `docs/cryptography.md` for the
specific correction of prior unfounded compliance claims (FIPS 140-2, Common
Criteria EAL4+, SOC 2 Type II, ISO 27001) that existed in earlier versions of this
codebase's API responses and comments.
