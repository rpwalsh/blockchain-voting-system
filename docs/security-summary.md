# Security Summary (non-technical)

Status: draft, v0.1. Plain-language companion to `docs/security-validation.md`, the
full technical pre-audit document. This version is written for a board, investor, or
other non-technical reviewer doing diligence before engaging or trusting this system.
Where the technical document hedges with code references, this one gives the
one-sentence version and points there for proof.

## What this is

A system for running elections (union votes, corporate board elections, municipal
ballots, governance votes) where the record of what happened is mathematically
checkable, not just something you have to trust the operator about. It uses real
cryptography — the same families of algorithms used in encrypted messaging apps and
password managers, plus a "zero-knowledge proof" technique that lets a voter prove
they hold a valid ballot without revealing which one.

## What this is not

- **It is not a cryptocurrency, and it does not use a blockchain in the financial
  sense.** No wallet, no coin, no token, no on-chain payment of any kind exists in this
  system. The one place it touches a public, blockchain-adjacent service
  (OpenTimestamps) is purely to get an independent, tamper-evident timestamp on the
  final election summary — the digital equivalent of getting a notary to stamp a
  document, nothing more.
- **It has not been independently audited or certified.** No government or industry
  certification (FIPS, Common Criteria, SOC 2, ISO 27001) has been obtained. Anyone who
  tells you otherwise about this system today is wrong — and we found one internal page
  (a technical whitepaper in the product itself) that incorrectly lists such
  certifications; that is being corrected as a priority, not something we're
  presenting to you as fact.
- **The final vote count is not yet cryptographically provable.** Today, if you look at
  a result, you are trusting the operator's database, the same as most conventional
  systems. The cryptographic pieces needed to make the *count itself* mathematically
  provable (not just "the ballots weren't tampered with after the fact") are under
  active construction and not finished. This is the single biggest thing standing
  between this system today and the claim "cryptographically verifiable election
  results."

## What's real and working today

- Every ballot is encrypted before it's stored.
- Every vote is recorded in a tamper-evident audit trail — if anyone (including us, the
  operator) alters or deletes a past record, that's mathematically detectable.
- A voter gets a receipt they can use to confirm their vote was counted, without that
  receipt revealing who they voted for (so it can't be used to prove your vote to a
  vote-buyer or coercer).
- A ballot-casting credential can only be used once, and using it requires a real
  cryptographic proof, not just a password.
- Known insecure shortcuts that existed earlier in development — a hardcoded admin
  password, a fallback security key — have been found and removed; we checked the
  current code directly to confirm this, not just old release notes.

## What's still missing, honestly

- The vote *count* isn't independently provable yet (see above) — treat any result
  today as "the operator says this is the count," not "this is mathematically proven."
- A single administrator account, if stolen, currently has more power than it should —
  requiring multiple people to agree (not just one login) before sensitive actions like
  opening or closing an election is planned but not yet built.
- The election's private encryption key is currently stored directly rather than split
  across multiple key-holders in a way that's actually enforced (the splitting
  mechanism exists and works, but isn't yet the only way to get at the key).
- No outside firm has reviewed this code yet. This document exists specifically to get
  the system ready for that review, honestly, rather than to claim the review has
  already happened.

## The one thing to know before showing this to anyone external

Before this goes in front of a real security auditor or a technical investor, one
specific internal page (the in-product cryptography whitepaper) needs a correction: it
currently lists compliance certifications the system does not hold. Everywhere else in
the codebase — including the developer-facing API — this is stated honestly and
correctly. That one page is the exception, it's a quick fix, and it should be fixed
before, not found by, an outside reviewer.
