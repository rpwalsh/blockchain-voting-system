# Trust Model

Status: **draft, v0.1**. Companion to `docs/protocol.md` and `docs/threat-model.md`.

This is the central design question for the whole project:

> **What happens if every individual component except the cryptographic assumptions
> is malicious?** That is the design target — not "what happens if everyone behaves."

## Component trust table

| Component | Must be trusted? | What can it do if compromised? | What detects it? | Status |
|---|---:|---|---|---|
| Voter client | No | Submit a malformed or dishonest ballot; display a different choice than it submits | Server-side ballot validation today; ZK ballot-validity circuit is the target | Server check only; no live casting endpoint yet (M1) |
| Election server | No | Suppress or alter records, forge responses | Voter-held receipts checked against a signed, externally-verifiable final root; independent verifier | Merkle/receipt primitives real; casting endpoint, signed finalization, independent verifier are M1/M4 |
| Database | No | Alter stored ballots/ledger directly | Merkle commitments + hash-chained ledger, independently reconstructible | Primitives real; the one endpoint claiming to check ledger-chain integrity currently hardcodes the result (fixed M1) |
| Election administrator | Limited | Configure the election; without threshold controls, could also open/close/certify unilaterally | Signed configuration manifest + audit log; target: M-of-N threshold authorization for sensitive actions | Single-key admin auth today (`requireOrgRole`); threshold admin is M5 |
| Trustee (key share holder) | Limited | Participate in decryption; below threshold, holds no useful information | Shamir threshold cryptography (K-of-N, currently 3-of-5) | Split/reconstruct implemented; no procedural enforcement against premature reconstruction |
| Tally process | No | Produce a false result | Tally proof, independently verifiable | Not implemented (M3) — no proof is generated today |
| Receipt verifier | No (it's the thing doing the checking) | N/A | Independent verification against the signed final root | Two inconsistent partial implementations exist today; unified in M1 |
| External timestamp anchor (if used) | No — notary, not security model | Nothing security-relevant; its only job is making the final commitment independently observable | The public timestamp ledger's own consensus | **Real**: `submitTimestampAnchor`/`checkTimestampAnchor` submit to OpenTimestamps, an independent public timestamping service — see `docs/cryptography.md`. No financial transaction, wallet, or token is involved |

## Reading the table

A "No" in "must be trusted" does not mean that component is powerless if
compromised — it means the *protocol* does not rely on that component behaving
honestly for its security properties to hold, because there is an independent,
cryptographic way to detect deviation. Every "No" row must have a real answer in the
"what detects it" column, backed by code, not a comment describing an aspiration.
Where the current implementation doesn't yet back that answer, this document says so
directly (see the "Status" column) rather than letting the aspirational description
stand alone.

## Why "blockchain" means two different things here

The project name and public description use "blockchain voting system," which
carries an implicit claim worth splitting into two separate things so neither gets
overstated:

1. **The system's own blockchain**: `LedgerEntry` (hash-chained, signed,
   append-only) plus the Merkle tree over all ballots. This is private to the
   project, requires no external dependency, and is what actually establishes
   integrity — ZK proofs, Merkle commitments, signatures, threshold cryptography,
   the append-only ledger. This is real today (see `docs/protocol.md`).

2. **An external timestamp anchor** (optional, additive): the *final election
   commitment* — not individual ballots — gets a publicly observable,
   hard-to-quietly-rewrite timestamp from an independent public timestamping
   service (OpenTimestamps), real as of this milestone. It commits to:

```
H(electionId || configurationHash || eligibilityRoot || ballotRoot || ledgerRoot || tallyCommitment || resultHash)
```

not to individual votes. Putting individual ballots on a public ledger would be
slower, more expensive, and directly harmful to voter privacy for no integrity
benefit the protocol doesn't already provide on its own. **No financial
transaction, wallet, or token is involved anywhere in this** — the public
timestamp ledger is used purely as an external clock, not a payment or currency
system, and this project never holds or spends anything. See
`docs/cryptography.md`, "On the external timestamp anchor," for the full
explanation and why that distinction is worth stating explicitly rather than
assumed obvious.

## Multi-tenant / governance layer

The `Organization` / `User` / `RBAC` layer (`prisma/schema.prisma`) sits outside the
election protocol proper — it answers "who is allowed to configure elections for
this tenant," not "is this election's result correct." A compromised `ORG_ADMIN`
session today can perform any administrative action a legitimate admin could,
because there is no threshold requirement on sensitive operations yet (see the
"Election administrator" row above). This is an accurate statement of current risk,
not a hypothetical.
