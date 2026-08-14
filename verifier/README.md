# election-verifier

Independent CLI that verifies an election's cryptographic integrity without
trusting the election server or its database. It reimplements the hashing,
Merkle, and signature logic standalone from `docs/protocol.md` and
`docs/cryptography.md` (see `src/crypto/`) rather than importing
`backend/src/crypto/engine.ts` - a verifier that trusts the code it's meant
to check can't catch a bug or tamper in that code.

## Install

```bash
cd verifier
npm install
npm run build
```

## Usage

Against a running backend (public, unauthenticated endpoints only):

```bash
npx election-verifier check --api https://votes.example.org --election <id> \
  --signing-key <election's published Ed25519 public key>
```

Against a locally exported audit bundle (see `src/bundle.ts` for the JSON
shape; a real export endpoint is Milestone 5 scope):

```bash
npx election-verifier check --bundle ./election-audit-export.json
```

A voter checking only their own ballot, without full election access:

```bash
npx election-verifier verify-receipt --api https://votes.example.org \
  --election <id> --receipt <your receiptHash>
```

`--json` for machine-readable output, `--allow-skip` to exit 0 even when a
check was skipped (e.g. no `--signing-key` supplied, so the finalization
signature's internal consistency was checked but not tied to a trusted key).

## What it checks

- **Finalization manifest** (`checks/manifest.ts`): recomputes
  `domainHash(ELECTION-FINALIZE, ...)` over the manifest fields and verifies
  the Ed25519 signature - against the supplied `--signing-key` if given,
  otherwise just for internal consistency (flagged as a `WARN`, not a
  `PASS`).
- **Merkle root** (`checks/merkleRoot.ts`): rebuilds the ballot Merkle tree
  from ciphertexts (RFC 6962-style leaf/node domain separation, odd-node
  promotion) and compares the root to the finalized `finalBallotRoot`.
- **Ledger chain** (`checks/ledgerChain.ts`): walks `previousEntryHash`
  links and verifies each entry's signature and `dataHash` independently.
- **Timestamp anchor** (`checks/timestampAnchor.ts`): confirms the OpenTimestamps
  proof actually attests the finalization manifest hash to a public
  timestamp ledger (unless `--skip-timestamp`).
- **Receipt** (`checks/receipt.ts`): verifies a single Merkle inclusion
  proof against the finalized root, for a voter checking their own ballot.

## What it does NOT check yet

- **Ballot secrecy / anonymous eligibility** (Milestone 2): today's ballots
  don't yet carry an anonymous eligibility proof to verify.
- **Tally correctness** (Milestone 3): no cryptographic tally proof exists
  yet to check a published result against.

This tool verifies protocol/ledger integrity - that the set of ballots
counted is the set that was actually cast and hasn't been tampered with
after the fact - not end-to-end privacy or tally correctness. It will be
extended once those milestones land.
