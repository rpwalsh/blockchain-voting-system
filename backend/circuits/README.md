# ZK-SNARK Implementation

## Overview

This voting system uses **Groth16 zk-SNARKs** for zero-knowledge proofs of
token validity. This is the same proof system used by:
- Zcash (private transactions)
- Tornado Cash (mixing protocol)
- Polygon Hermez (L2 scaling)
- Loopring (DEX protocol)

## Security Properties

- **Zero-Knowledge**: Proves token possession without revealing it
- **Succinct**: Groth16 proofs are ~200 bytes, verify in single-digit ms
- **Non-Interactive**: No back-and-forth with verifier
- **Publicly Verifiable**: Anyone with `verification_key.json` can verify a proof
- **Post-Quantum Migration Path**: Can be replaced with STARK/FRI without
  changing anything outside the proof layer (see below)

## `token_validity` circuit

Proves knowledge of a private voting token and a salt whose salted Poseidon
commitment (over the BN254/alt_bn128 scalar field) matches a public
commitment, without revealing the token - and binds the proof to a specific
server-issued challenge via a public nullifier, so a captured proof can't be
replayed against a later challenge. This is what backs
`generateTokenValidityProof` / `verifyTokenValidityProof` /
`computeTokenCommitment` in `src/crypto/engine.ts`.

Source: `token_validity.circom`. Circuit stats: 487 non-linear + 549 linear
constraints, 1040 wires, 2 public inputs (`tokenHashCommitment`,
`challengeHash`), 2 outputs (`validityFlag`, `nullifier`), 2 private inputs
(`tokenPreimage`, `salt`).

```
public inputs:  tokenHashCommitment, challengeHash
private inputs: tokenPreimage, salt
outputs:        validityFlag, nullifier
```

`verifyTokenValidityProof(proof, expectedCommitment, expectedChallenge)`
checks, in order: the circuit's `publicSignals` array has the expected
shape, `validityFlag === '1'`, the commitment in the proof matches
`expectedCommitment`, the challenge hash matches `expectedChallenge`, and
only then runs the real Groth16 pairing check (`snarkjs.groth16.verify`)
against `verification_key.json`. Rejecting on a mismatched commitment or
challenge before the pairing check is a cheap, honest short-circuit - it
doesn't weaken the proof, since the pairing check would reject those cases
anyway once you're comparing against the caller's expected values.

## Build artifacts (`build/`)

These are committed to the repo (see the `!backend/circuits/build/`
exception in `.gitignore`) rather than gitignored, because
`generateZKProof` checks for their existence at runtime and silently falls
back to a non-ZK path if they're missing - anyone cloning the repo needs
the real artifacts present to get real proofs, not just the source.

- `token_validity.r1cs`, `token_validity.sym` - compiled circuit
- `token_validity_js/token_validity.wasm` - witness calculator
- `pot12_final.ptau` - Powers of Tau ceremony (bn128, 2^12 = 4096
  constraints), generated locally rather than fetched from a third-party
  ceremony - reasonable for a circuit this size in a demo project, see
  "Production trusted setup" below for what a real deployment needs instead
- `token_validity.zkey` - circuit-specific Groth16 proving key, after
  phase-2 setup and a contribution
- `verification_key.json` - exported Groth16 verification key (safe to be
  public; this is what `verifyZKProof` reads)

## Regenerating

```bash
cd backend/circuits
circom token_validity.circom --r1cs --wasm --sym -o build/
npx snarkjs powersoftau new bn128 12 build/pot12_0000.ptau -v
npx snarkjs powersoftau contribute build/pot12_0000.ptau build/pot12_0001.ptau --name="contribution" -v
npx snarkjs powersoftau prepare phase2 build/pot12_0001.ptau build/pot12_final.ptau -v
npx snarkjs groth16 setup build/token_validity.r1cs build/pot12_final.ptau build/token_validity_0000.zkey
npx snarkjs zkey contribute build/token_validity_0000.zkey build/token_validity.zkey --name="contribution" -v
npx snarkjs zkey export verificationkey build/token_validity.zkey build/verification_key.json
```

## Production trusted setup

The ceremony above is a single-contributor local setup - fine for a demo,
**not** sufficient for a real election. A production deployment needs a
multi-party ceremony:

### Option A: Use an existing large ceremony (recommended)

Reuse a Powers of Tau output from an established public ceremony instead of
running your own, e.g. the Hermez ceremony (supports circuits up to 2^16
constraints, well above this circuit's size, and already has hundreds of
public contributions):

```bash
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau
```

### Option B: Run your own multi-party ceremony

```bash
snarkjs powersoftau new bn128 16 pot16_0000.ptau
snarkjs powersoftau contribute pot16_0000.ptau pot16_0001.ptau --name="Participant 1"
snarkjs powersoftau contribute pot16_0001.ptau pot16_0002.ptau --name="Participant 2"
snarkjs powersoftau contribute pot16_0002.ptau pot16_0003.ptau --name="Participant 3"
# minimum 3 independent participants; more contributors -> stronger
# soundness guarantee, since only one honest participant needs to destroy
# their toxic waste for the whole ceremony to be secure
snarkjs powersoftau prepare phase2 pot16_0003.ptau pot16_final.ptau

snarkjs groth16 setup token_validity.r1cs pot16_final.ptau token_validity_0000.zkey
snarkjs zkey contribute token_validity_0000.zkey token_validity_0001.zkey --name="Participant 1"
snarkjs zkey contribute token_validity_0001.zkey token_validity_final.zkey --name="Participant 2"
snarkjs zkey verify token_validity.r1cs pot16_final.ptau token_validity_final.zkey
snarkjs zkey export verificationkey token_validity_final.zkey verification_key.json
```

Security controls that matter for a ceremony backing a real election:
air-gapped participant machines, secure deletion of intermediate ("toxic
waste") files immediately after each contribution, independent
geographically-distributed participants, a public transcript of every
contribution, and diverse entropy sources per participant.

## What's real vs. not yet

`token_validity` is a real, verified end-to-end Groth16 circuit -
`generateZKProof`/`verifyZKProof` in `engine.ts` call `snarkjs.groth16`
directly against the committed artifacts above, and
`src/__tests__/crypto/engine-zk-paths.test.ts` generates and verifies real
proofs with no mocking: it confirms a proof verifies against the right
commitment/challenge, that it's rejected against the wrong token
commitment, rejected against a stale challenge, rejected when tampered, and
that the nullifier differs across challenges for the same token (replay
protection).

`vote-validity` has no compiled circuit yet. `generateVoteValidityProof`
falls back to a Fiat-Shamir-style commitment in that case - it's labeled
`protocol: 'fiat-shamir-fallback'` in the returned object specifically so
it can't be confused with (or accidentally accepted as) a real Groth16
proof. `verifyZKProof` refuses to verify anything that isn't
`protocol: 'groth16'`.

## Post-quantum path

Groth16's soundness relies on elliptic-curve pairing assumptions, which are
not post-quantum secure. If that ever becomes a real threat model for this
system, the proof layer (this circuit + `snarkjs.groth16.*` calls in
`engine.ts`) can be swapped for a STARK/FRI-based system without changing
anything else in the application - the commitment scheme and public
interface (`generateTokenValidityProof`/`verifyTokenValidityProof`) stay
the same either way.

## References

- Circom: https://docs.circom.io/
- snarkjs: https://github.com/iden3/snarkjs
- Groth16 paper: https://eprint.iacr.org/2016/260.pdf
- Hermez Powers of Tau ceremony: https://blog.hermez.io/hermez-powersoftau-ceremony-begins/
- Zcash parameter generation: https://z.cash/technology/paramgen/
- Trusted setup explainer: https://vitalik.ca/general/2022/03/14/trustedsetup.html
