# Security Validation / Pre-Audit Readiness Document

Status: **draft, v0.1**. Written as Milestone 6 of a 7-milestone hardening effort.
Companion to `docs/protocol.md`, `docs/threat-model.md`, `docs/trust-model.md`, and
`docs/cryptography.md` — this document does not restate those in full; it cites them
and adds an auditor's framing: what to inspect, what to trust, what to budget hours
against. Where this document and those documents disagree with what the current code
actually does, the code wins and the discrepancy is noted explicitly (see "Known
documentation/code discrepancies" below).

Milestones 2 (anonymous eligibility/ZK credentials), 3 (cryptographic tally), 4
(independent verifier CLI), 5 (operational election features), and 7 (UI polish) were
running in parallel with this document's authorship. Sections describing that work are
marked **status: in progress as of this writing** rather than asserted complete or
incomplete — verify against the current `git log` and code before relying on them.

---

## 1. Executive summary

**What this system is:** a cryptographically auditable election/governance protocol.
Concretely: Ed25519-signed, hash-chained append-only ledger entries; a domain-separated
SHA3-256 Merkle tree over cast ballots; NaCl-box-encrypted ballots; a real Groth16
zk-SNARK circuit proving knowledge of a voting credential without revealing it; Shamir
threshold splitting of the election decryption key; and a signed finalization manifest
optionally anchored to OpenTimestamps, an independent public timestamping service. The
design goal (`docs/trust-model.md`) is that voters and third parties can detect
tampering by a fully compromised server/database without trusting that server — for
the properties actually backed by working code today (see Section 3).

**What this system is not:**

- **Not a cryptocurrency or blockchain-in-the-financial-sense product.** No wallet, no
  token, no on-chain financial transaction exists anywhere in this codebase. The
  project's own append-only `LedgerEntry` + Merkle tree is a private, self-contained
  data structure, not a public distributed ledger with consensus. The one place a
  public ledger is touched is OpenTimestamps, used exclusively to timestamp the hash
  of a finalization manifest — the equivalent of a notary stamp, not a payment
  rail. See `docs/trust-model.md`, "Why 'blockchain' means two different things
  here."
- **Not independently audited or certified.** No FIPS 140-2, Common Criteria, SOC 2
  Type II, or ISO 27001 certification exists or is claimed by the backend
  (`backend/src/routes/crypto-audit.ts` explicitly disclaims this). **Important
  exception found during this review:** `frontend/src/pages/CryptoWhitepaper.tsx`
  (section "11.3 Compliance Standards", lines 1085–1092) still lists FIPS 140-2 Level
  3, Common Criteria EAL4+, NIST SP 800-57, EAC VVSG 2.0, and GDPR Article 25 as if
  the system holds them, with no disclaimer, on a page whose own footer says it is
  "provided for technical review and security audit purposes." This directly
  contradicts the honest backend docs and must be corrected before this system is
  shown to a real auditor — see Section 7 and the discrepancy note in Section 3.
- **Not a complete, self-verifying election system yet.** The cryptographic *tally*
  (turning cast ballots into a provably-correct result) is not implemented as of this
  writing — see Section 4, item 1. Treat any currently-displayed result as
  operator/database-trusted, not cryptographically verified.
- **Not resistant to a dishonest voting client**, by design acknowledgment
  (`docs/threat-model.md`, "Malicious/compromised voting client") — no software can
  guarantee a client shows a voter's true choice back to them; this is flagged as an
  open problem, not silently ignored.

**Bottom line for an auditor or technical diligence reviewer:** the cryptographic
*primitives* (hashing, signing, encryption, one real ZK circuit, Merkle proofs, Shamir
splitting) are real, working, and reasonably well-tested in isolation. The *protocol*
composed from them is partially enforced end-to-end: ballot casting, credential
issuance, replay protection, and finalization are live and enforced as of this
writing; election lifecycle immutability, anonymous credentials, cryptographic tally,
and independent recount are not. This is an accurate, current snapshot, not a
sales pitch — see Section 4 for what to spend audit hours on first.

---

## 2. Cryptographic primitive inventory

Pulled from `docs/cryptography.md` and cross-checked against
`backend/src/crypto/engine.ts` and `backend/src/crypto/canonical.ts` directly (not
just the docs) as of this writing.

| Primitive | Algorithm / library | Status | Known limitations |
|---|---|---|---|
| Digital signatures | Ed25519 (`tweetnacl`) | **Real** | Single election-officer key today; no M-of-N threshold signing (planned Milestone 5) |
| Election keypair | Curve25519 NaCl box (`tweetnacl`) | **Real** | Private key stored in **plaintext** in `Election.privateKey` (see `backend/prisma/schema.prisma` line 310 and its own code comment) — no HSM/KMS integration exists despite `keyShares` (Shamir) being populated as a parallel recovery mechanism |
| Ballot encryption | Curve25519-XSalsa20-Poly1305 (NaCl box) | **Real**, authenticated | Plaintext payload is `{candidateId, timestamp, nonce, integrity}` only — does **not** bind `electionId` or a ballot-definition hash into the plaintext, contrary to the target design described in `docs/protocol.md`'s "Stage: Ballot construction." Verified directly in `backend/src/crypto/engine.ts`, `encryptVote()` (lines 357–391) and its caller `backend/src/routes/ballot.ts` line 217, which passes only `candidateId`. `docs/cryptography.md`'s primitive table correctly flags this as a fallback; treat `docs/protocol.md`'s prose describing this as solved as aspirational, not current |
| Hashing (general) | SHA3-256/512 (`js-sha3`), domain-separated | **Real** | Domain separation (`H(tag \|\| 0x00 \|\| canonicalize(payload))`) is implemented in `backend/src/crypto/canonical.ts` and used consistently at every hash site checked in this review, including the election-eligibility snapshot hash (`backend/src/routes/governance.ts` line 686) — this is **more complete than `docs/protocol.md` currently states**; see discrepancy note below |
| Identity hashing | PBKDF2-SHA512, 210,000 iterations | **Real** | Deliberately slow (guessable-input protection); documented rationale in `docs/cryptography.md` |
| Merkle tree | SHA3-256, domain-separated leaf/node tags | **Real** | RFC 6962-style leaf/node separation and CVE-2012-2459-class odd-node handling both implemented (`backend/src/crypto/engine.ts`, `MerkleTree` class) |
| Shamir secret sharing | GF(256) polynomial interpolation, project-written | **Real, not externally audited** | Source comment itself recommends `secrets.js-grempe` or `@stablelib/secret-sharing` for production; nothing enforces that shares can't be combined before election close (`reconstructSecretShamir` is callable at any time by anyone holding ≥3 shares) |
| zk-SNARK: `token_validity` | Groth16 / BN254, `snarkjs` + `circomlibjs` (Poseidon) | **Real** | Compiled circuit and trusted-setup artifacts are committed (`backend/circuits/build/`); the Powers-of-Tau ceremony is a **single-contributor local ceremony** — explicitly documented in `backend/circuits/README.md` as insufficient for a real election, with a documented remediation path (reuse an established public ceremony, e.g. Hermez) |
| zk-SNARK: `vote-validity` (ballot validity without revealing choice) | — | **Not implemented** | No circuit exists. `generateVoteValidityProof` always returns the `fiat-shamir-fallback` protocol — a commitment, not a zero-knowledge proof — and is honestly labeled as such in its own `protocol` field. Confirmed still true by reading `backend/src/crypto/engine.ts` lines 588–598 and its only caller, `backend/src/routes/ballot.ts` line 218 |
| Tally correctness proof | — | **Not implemented** | `TallyResult.proof` is a schema field. The only code paths that populate it are seed scripts (`seed-demo.ts`, `seed-production.ts`, `seed-clean.ts`), and in `seed-production.ts` line 270 the "proof" value is literally `crypto.generateChallenge()` — random bytes with no relationship to the vote data whatsoever. No live route creates a `TallyResult` |
| External timestamp anchor | OpenTimestamps (`opentimestamps` npm package) | **Real** | Submits/upgrades against live OpenTimestamps calendar servers (`submitTimestampAnchor`/`checkTimestampAnchor` in `backend/src/crypto/engine.ts`); asynchronous confirmation (hours), honestly reported as pending until actually confirmed. No wallet/token/financial component |
| Legacy "blockchain anchor" | `generateBlockchainAnchor()` | **Honestly disabled** | Still present for backward compatibility, hardcodes `real: false`, `blockNumber: null` — pure local commitment digest, no network call. Not used by the finalization flow, which uses `submitTimestampAnchor` instead |
| DAG (`VoteDAG`) | — | **Data structure only** | Implemented as a class with cycle detection; not wired into any live route |

### Known documentation/code discrepancies found during this review

1. **`docs/protocol.md` understates progress on eligibility-snapshot hashing.** It
   states (line 111–112) that election creation "uses `crypto.hashVotingToken()` (bare
   SHA3-256, no domain tag) rather than a domain-separated hash." Reading
   `backend/src/routes/governance.ts` line 686 directly shows this now uses
   `domainHash(DOMAIN.ELECTION_ELIGIBILITY, ...)` — the domain-separated form. The doc
   appears to predate a fix that has since landed. Not a security issue; a doc drift
   worth correcting.
2. **`frontend/src/pages/CryptoWhitepaper.tsx` makes uncorrected compliance claims**
   (FIPS 140-2 Level 3, Common Criteria EAL4+, NIST SP 800-57, EAC VVSG 2.0, GDPR
   Article 25 — lines 1085–1092) that directly contradict `docs/cryptography.md`'s
   explicit statement that no such certification has been obtained. This is the kind
   of claim `docs/cryptography.md` says was corrected "in earlier versions of this
   codebase's API responses and comments" — the backend API responses were fixed
   (`crypto-audit.ts` is honest); this frontend page was not. Flagged as a priority fix
   in Section 7.
3. **`docs/protocol.md`'s "Ballot inclusion" and "Receipt verification" sections
   describe the two verifier code paths as unified under Milestone 1.** Reading the
   current code: `backend/src/routes/election-player.ts` `POST /:electionId/verify-vote`
   (lines 190–243) *does* check the recomputed Merkle root against the signed
   `finalization.finalBallotRoot` when one exists, falling back to the live
   `election.merkleRoot` otherwise — this matches the target design.
   `backend/src/routes/governance.ts` `POST /verifier/receipt` (lines 768–809) does
   **not**: it recomputes a Merkle proof from the current vote set and reports
   `included: proofValid`, but `proofValid` is trivially true whenever the proof is
   constructed from the same tree it's checked against — it never compares the
   recomputed root against the signed finalization manifest or even the stored
   `election.merkleRoot`. This is a real, current gap: it is possible to pass this
   endpoint's "verified" response by reconstructing a Merkle proof from *whatever the
   database currently contains*, which is exactly the failure mode Milestone 1's
   finalization work exists to prevent. Reconciling this with `election-player.ts`'s
   correct version is outstanding work, not yet complete despite the docs' framing.

---

## 3. Threat model coverage (adversary-by-adversary, verified against current code)

Full detail lives in `docs/threat-model.md`; this section adds direct code references
and flags where this review's code-reading changed the picture.

### Malicious voter
- **Duplicate voting**: mitigated for real. `backend/src/routes/ballot.ts` lines
  226–235 use a transactional `updateMany({ where: { id: voter.id, hasVoted: false }
  })` — atomic at the database level, so a race between two concurrent submissions
  using the same credential is closed (loser gets `DOUBLE_VOTE_RACE` → HTTP 409), not
  just checked-then-acted-on non-atomically.
- **Replay of a captured proof**: mitigated for the `token_validity` proof
  specifically. The freshness challenge is server-issued, single-use, and checked
  atomically-ish: `ballot.ts` checks `nonce.consumedAt` then verifies the proof, then
  marks the nonce consumed (line 215) — **note:** the consume step is not guarded by a
  conditional update (`WHERE consumedAt IS NULL`), so two concurrent requests
  presenting the *same* challenge and proof have a narrow TOCTOU window where both
  could pass the "not yet consumed" check before either write lands. In practice this
  doesn't enable a double-vote (the `hasVoted` transactional guard above is what
  actually prevents that), but it means the challenge-consumption invariant itself
  isn't atomic — worth a one-line fix (`updateMany` with a `consumedAt: null` guard)
  before an audit engagement, and worth flagging to auditors as a concurrency edge
  case rather than a silently-fixed item.
- **Malformed ballot / proof**: `candidateId` is checked against the certified
  candidate list server-side (`ballot.ts` line 175); this is not yet a ZK proof of
  ballot validity (`vote-validity` circuit doesn't exist — see Section 2).
- **Credential theft**: current voting token is a server-issued bearer secret the
  server can trace back to `externalId` at registration time
  (`backend/src/routes/ballot.ts` lines 43–117). Anonymous/unlinkable credentials are
  Milestone 2 scope — **status: in progress as of this writing**, not present in the
  code reviewed here.

### Malicious election administrator
- **Rewrite the final Merkle root**: mitigated. `backend/src/routes/finalization.ts`
  produces a one-time, signed `ElectionFinalization` manifest; `GET
  /:electionId/finalization` independently re-verifies the signature before returning
  it (lines 160–163) rather than trusting its own database read blindly.
- **Alter configuration after voting opens**: **not mitigated**. There is no
  certification/immutability-freeze step between `DRAFT` and later statuses in the
  current schema or route code; any field can be updated via a direct write at any
  status.
- **Single admin sufficiency**: confirmed still true — `requireOrgRole(['ORG_ADMIN',
  ...])` (`backend/src/middleware/auth.ts` lines 72–85) gates sensitive actions on a
  single authenticated session with no M-of-N threshold requirement. A stolen
  `ORG_ADMIN` JWT is sufficient, on its own, to open/close/certify an election today.
- **Fabricate ballots**: no enforcement point yet prevents an admin with database
  access from inserting `Vote` rows directly (the ballot-casting endpoint being real
  doesn't stop a privileged actor from bypassing it at the DB layer) — the *detection*
  mechanism (Merkle/ledger recomputation catching a mismatch) is real, but nothing
  currently *runs* that detection automatically or continuously; it's an on-demand
  check via `crypto-audit.ts`.

### Compromised election server / database
This is the category the project's cryptography is built to answer, and where the
most real progress exists:
- **Silently modify/delete a stored ballot**: detectable via Merkle root recomputation
  (`crypto-audit.ts` `GET /election/:id/integrity`, "Merkle Tree Integrity" check,
  lines 269–291) — genuinely recomputes the tree from current `Vote` rows and compares
  against the stored root, deriving PASS/FAIL from the actual comparison rather than
  hardcoding it.
- **Reorder/forge ledger entries**: the "Ledger Chain Integrity" check
  (`crypto-audit.ts` lines 293–333) now walks `previousEntryHash`, recomputes each
  entry's `dataHash`, and verifies each entry's Ed25519 signature — this was
  previously hardcoded `chainValid = true`; confirmed fixed by reading the code
  directly.
- **Concurrency gap found in this review**: `createLedgerEntry`
  (`backend/src/utils/audit.ts` lines 197–244) reads the "previous entry" and writes
  the new entry as two separate, non-transactional operations, with no row lock or
  optimistic-concurrency check between them. Two ballots cast concurrently for the
  same election can both read the same "latest" entry as their `previousEntryHash`,
  producing two ledger entries that both claim the same predecessor — a forked chain
  that `crypto-audit.ts`'s chain-walk (which assumes one linear order by `timestamp
  asc`) would likely flag as `previousEntryHash does not match prior entry's dataHash`
  for whichever entry sorts second. This is a real, exploitable-under-load integrity
  bug, not just a theoretical one, given ballot casting is exactly the code path that
  can be concurrent in production. Recommend either serializing ledger-entry creation
  per election (e.g. a `SELECT ... FOR UPDATE` on the election row, or a DB-level
  sequence) before any real election runs on this code.
- **Substitute the tally result**: **not mitigated** — see Section 4, item 1.
- **Report false PASS/FAIL to auditors**: confirmed every check in
  `crypto-audit.ts`'s integrity endpoint derives its status from an actual computed
  comparison (grep-verified: no hardcoded `status: 'PASS'` literals remain in that
  file's check logic).

### Colluding trustees / key holders
Shamir split/reconstruct is real and independently exercised
(`backend/src/crypto/engine.ts` lines 190–298), but two things stand out: (1) it's a
project-written implementation, not an externally vetted library, and (2) the
`Election.privateKey` column stores the plaintext key directly and the ballot-decrypt
path (where it exists) would read that column, not require share reconstruction — so
Shamir splitting exists as a real, working *capability* but is not currently the
*enforced* path to decryption. An attacker (or insider) with database read access
doesn't need 3-of-5 shares; they need one column value.

### Malicious/compromised voting client
Flagged, not solved, consistent with `docs/threat-model.md`'s own framing. No code
change needed here to make this document accurate — this is one of the harder,
honestly-unsolved categories and should stay that way in any summary given to a VC or
auditor rather than being quietly dropped.

### Network attacker
`helmet()` and `express-rate-limit` are present and configured
(`backend/src/config.ts` validates `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX_REQUESTS` via
Joi with sane defaults). Rate limiting is global/coarse, not tuned per-endpoint
sensitivity (e.g., the ballot-casting and login endpoints share the same budget as
read-only endpoints) — reasonable for a first pass, worth auditor attention for
brute-force/DoS scenarios against `/vote` and `/login` specifically.

### Supply-chain attacker
Lockfiles (`backend/package-lock.json`, `frontend/package-lock.json`) are present.
`package.json` dependency ranges use `^` (caret) semver ranges, not exact pins — so the
lockfile is the actual source of truth for what's installed, but a `npm install`
without `--ci`/frozen-lockfile discipline could drift. No reproducible-build
attestation, no dependency-vulnerability scanning wired into any pipeline (there is no
CI pipeline at all yet — `docs/DEVELOPER_GUIDE.md` line 152 lists "Add CI pipeline that
runs lint plus real test commands" as an open TODO).

### Coercer
Receipts are designed to prove inclusion, never choice
(`docs/protocol.md`'s `ElectionReceipt`), and nothing in the current codebase mints a
transferable, choice-revealing artifact per vote — confirmed by reading the actual
receipt construction in `ballot.ts` (`receiptHash` is a salted hash with no candidate
information in the returned payload). Re-vote / last-vote-counted semantics to blunt
in-person coercion remain unspecified, honestly, per `docs/threat-model.md`.

---

## 4. What a real third-party audit should spend its hours on, ranked

This ranking reflects both severity (what breaks if the gap is exploited) and
likelihood an auditor would find it quickly (which affects how much of the audit
budget it's worth reserving).

1. **The tally has no cryptographic correctness proof — treat any current tally as
   operator-trusted, not cryptographically verified.** Verified directly against
   current code, not just the docs: `TallyResult` rows are created **only** by seed
   scripts (`seed-demo.ts`, `seed-production.ts`, `seed-clean.ts`); no live route in
   `backend/src/routes/` creates one. Worse, `seed-production.ts` line 270 populates
   the `proof` field with `crypto.generateChallenge()` — literally unrelated random
   bytes, not even the honest fiat-shamir-fallback commitment used elsewhere. Any
   result display the frontend renders today is reading a plaintext `candidateId`
   count off the `Vote` table (or a seeded `TallyResult`), full stop. This is the
   single largest gap between what "cryptographic election protocol" implies and what
   exists. Budget the largest share of audit hours here once Milestone 3 lands, and in
   the meantime, do not represent current tallies as cryptographically verified in any
   external communication.
2. **Live compliance-claim contradiction in `CryptoWhitepaper.tsx`** (Section 2,
   discrepancy #2). Cheap to fix, high reputational/legal risk if an auditor or
   investor reads it before the honest backend docs. This should be fixed *before*
   engaging an external auditor, not found by them.
3. **`Election.privateKey` stored in plaintext**, with Shamir splitting present but not
   enforced as the decrypt path (Section 3, "Colluding trustees"). A single database
   read compromises ballot secrecy for the whole election. This is explicitly
   documented in the schema's own code comment, so it's a known, not hidden, gap — but
   it's the kind of finding that should be first on an auditor's list of "what does
   database compromise actually cost us."
4. **Single-key admin authority over election lifecycle** (open/close/certify) with no
   M-of-N requirement (Section 3, "Malicious election administrator"). A stolen
   `ORG_ADMIN` session is fully sufficient today.
5. **Ledger-entry creation race condition** (Section 3, "Compromised election server").
   Concrete, code-verified, and plausible under real concurrent load (simultaneous
   ballot casts). Recommend fixing before this document is handed to an external
   auditor, since "does the audit trail actually stay linear under load" is a natural
   first test for any competent reviewer to run.
6. **No election-configuration immutability after opening.** Anything can be edited at
   any status via a direct write. Combined with item 4, this means a single
   compromised admin session can alter candidates, dates, or eligibility rules mid-election.
7. **`governance.ts`'s `/verifier/receipt` endpoint doesn't check against an
   authoritative root** (Section 2, discrepancy #3) — its "verified" response is weaker
   than it appears and weaker than the sibling endpoint in `election-player.ts`.
8. **Ballot plaintext doesn't bind `electionId`/ballot-definition** (Section 2 table).
   Lower urgency than the above because the practical exploit path (key reuse across
   elections) is narrow, but it's a real gap between the documented target design and
   current code, and cheap to close once prioritized.
9. **`vote-validity` ZK circuit doesn't exist.** Ballot validity is checked in
   plaintext server-side today, not proven in zero knowledge. This is a known,
   documented gap (Milestone 3), not a surprise, but it means "ballot secrecy from the
   server" is not yet a property this system has for the choice itself, only for the
   *at-rest* ciphertext (the server sees `candidateId` in the clear on every `Vote`
   row it writes — confirmed in `ballot.ts` line 249).
10. **Trusted setup for `token_validity` is a single-contributor local ceremony.**
    Documented honestly with a remediation path in `backend/circuits/README.md`; worth
    verifying that remediation actually happens before any real election, not treating
    the current ceremony as production-grade.

---

## 5. Explicit non-goals / out of scope

Stated plainly rather than silently omitted, per this milestone's brief:

- **Side-channel / hardware attacks** (timing attacks against the host CPU, power
  analysis, cold-boot attacks on key material in memory) — not analyzed or mitigated
  beyond incidental use of constant-time comparison primitives (`timingSafeEqual`) at
  a few specific comparison sites. No hardware-level threat modeling has been done.
- **Supply-chain compromise of the build pipeline itself** — there is no CI pipeline
  yet (confirmed: `docs/DEVELOPER_GUIDE.md` lists this as an open TODO), so there is
  currently no automated build to compromise, which is itself a gap (see Section 6)
  rather than a mitigated risk.
- **Physical security of election administrators, poll workers, or voters** — entirely
  outside this codebase's scope; assumed to be handled by whatever organization
  deploys this system.
- **Denial-of-service at the infrastructure/network level** (DDoS, BGP hijacking,
  upstream provider compromise) — only application-layer rate limiting is in scope
  here; infrastructure-layer DoS protection is a deployment concern.
- **Client device compromise** (malware on the voter's own machine, a compromised
  browser extension) — distinct from, and out of scope beyond, the "malicious voting
  client" category already covered honestly in `docs/threat-model.md` as an
  acknowledged-unsolved problem, not a silently-ignored one.
- **Legal/regulatory certification** (state or federal election-system certification,
  EAC VVSG conformance testing, accessibility compliance beyond what's incidentally
  present in the frontend) — none of this has been pursued and none is claimed by the
  backend; see Section 1's note on the one frontend page that currently claims
  otherwise.
- **Multi-tenant SaaS layer security in depth** (billing, RBAC edge cases, webhook
  signing verification, SSO/OIDC provider trust) — `docs/trust-model.md` explicitly
  scopes this layer as answering "who can configure an election," not "is the
  election's result correct," and this document follows that same scoping. A real
  audit of the tenant/governance layer is a separate, valid engagement from an audit of
  the election protocol itself.

---

## 6. Audit-readiness checklist

| Item | Status today | What's needed |
|---|---|---|
| Reproducible builds | **Not done** | No CI pipeline exists yet; no build-artifact hash/signature is published. Needed: pinned toolchain versions, a CI job that builds from a clean checkout and publishes a build hash. |
| Pinned dependencies | **Partial** | `package-lock.json` exists and pins exact installed versions; `package.json` itself uses `^` ranges. Needed: either commit to lockfile-only installs (`npm ci`) in all environments including local dev, or move to exact pins in `package.json` for security-critical deps (`tweetnacl`, `snarkjs`, `jsonwebtoken`, `bcrypt`). |
| Documented key-ceremony process | **Partial** | `backend/circuits/README.md` documents the current single-contributor Powers-of-Tau ceremony and explicitly what a production multi-party ceremony needs (Option A: reuse an established ceremony like Hermez). The *election signing key* and *election encryption key* ceremonies (who generates them, how, and how the private key is protected at rest) have no equivalent documented process — today they're generated in-process by `generateElectionKeyPair()`/`generateKeyPair()` and stored in plaintext columns. Needed: a written key-ceremony doc for election-level keys, not just the ZK trusted setup. |
| No hardcoded credentials / backdoors | **Done** | Confirmed by reading `backend/src/routes/auth.ts` and `backend/src/scripts/bootstrap-superadmin.ts` directly: the previous behavior (POSTing `{username: "admin", password: "admin"}` to the public login endpoint silently created a level-12 super-admin) is gone. Super-admin accounts are now provisioned out-of-band via a script that generates a real random password, prints it once, and never persists it in plaintext. Login only ever `bcrypt.compare`s against a stored hash. |
| No insecure default secrets | **Done** | `backend/src/config.ts` uses Joi to require `JWT_SECRET`/`COOKIE_SECRET` (min 32 chars) with no fallback default, and additionally throws in production if either contains the literal string `change-this-in-production`. |
| Honest capability reporting | **Mostly done, one gap found** | `backend/src/routes/crypto-audit.ts` makes no false claims and is actively tested (`__tests__/routes/crypto-audit.test.ts`). `frontend/src/pages/CryptoWhitepaper.tsx` still does (Section 1/2). Fix before external audit. |
| PASS/FAIL derived from real computation, not literals | **Done** | Verified directly in `crypto-audit.ts`'s integrity endpoint — every check computes its status from an actual comparison. |
| Threat model / trust model documented | **Done** | `docs/threat-model.md` and `docs/trust-model.md` are current, specific, and (per this review) largely accurate against the code, with the exceptions noted in Section 2's discrepancy list. |
| Dependency vulnerability scanning | **Not done** | No `npm audit` / Dependabot / Snyk equivalent wired into any pipeline (there is no pipeline). |
| Test coverage of protocol-critical paths | **Partial** | Real test suites exist for crypto primitives (`__tests__/crypto/`), the ballot protocol end-to-end (`__tests__/e2e/ballot-protocol.test.ts`), authentication, and the crypto-audit endpoints. No test exercises the ledger-chain concurrency issue found in Section 3, and no test exists for tally correctness because no tally-correctness code exists yet. |
| Election-configuration immutability after open | **Not done** | See Section 4, item 6. |
| M-of-N administrative authorization | **Not done** | See Section 4, item 4. |
| Independent verifier (out-of-process, no server trust required) | **Not done** | Milestone 4 scope; **status: in progress as of this writing** — not present in the code reviewed for this document. |
| Incident-response / key-compromise runbook | **Not done** | No documented procedure exists for "what happens if an election private key or signing key leaks." |

---

## 7. Immediate action items before engaging an external auditor

In priority order, cheapest/highest-leverage first:

1. Remove or correct the compliance claims in `frontend/src/pages/CryptoWhitepaper.tsx`
   (Section 1, 2). This is a documentation-only fix and should not wait for any
   milestone.
2. Fix the `governance.ts` `/verifier/receipt` endpoint to check against the signed
   finalization root (or the live `election.merkleRoot` when unfinalized), matching
   `election-player.ts`'s already-correct implementation, and consider deleting one of
   the two duplicate implementations entirely in favor of a shared function.
3. Serialize `createLedgerEntry` per election (row lock or DB sequence) to close the
   concurrent-chain-fork issue in Section 3.
4. Guard the challenge-consumption update in `ballot.ts` with a conditional
   (`WHERE consumedAt IS NULL`) rather than an unconditional update, closing the TOCTOU
   window noted in Section 3.
5. Write the key-ceremony document for election-level signing/encryption keys (not
   just the ZK trusted setup, which is already documented).
6. Stand up a minimal CI pipeline (lint + test on every PR) — currently absent
   entirely, which blocks both "reproducible builds" and "dependency scanning" checklist
   items at the root.

None of these are large engineering efforts; all of them materially change what an
external auditor would find in the first day of a real engagement.
