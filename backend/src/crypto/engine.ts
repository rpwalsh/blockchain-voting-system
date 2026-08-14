/**
 * Cryptography engine for the election protocol.
 *
 * See docs/cryptography.md for an honest per-primitive breakdown of what's
 * real vs. fallback here - in particular, the token_validity Groth16 circuit
 * is real; vote-validity and tally-correctness proofs are not implemented
 * yet (fiat-shamir-fallback only), and generateBlockchainAnchor() is a
 * locally-computed digest, not a real chain transaction. This file makes
 * no compliance or certification claims (no FIPS, Common Criteria, SOC 2,
 * ISO 27001, etc). Using NIST-recommended algorithms (true, see below) is
 * not the same claim as holding a certification.
 */

import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import { randomBytes, timingSafeEqual, createHash, pbkdf2Sync } from 'crypto';
import { sha3_256, sha3_512 } from 'js-sha3';
import { DOMAIN, domainHashRaw } from './canonical';
// @ts-ignore - snarkjs doesn't have complete TypeScript definitions
const snarkjs = require('snarkjs');
const { groth16 } = snarkjs;
// @ts-ignore - circomlibjs doesn't ship complete TypeScript definitions
const { buildPoseidon } = require('circomlibjs');

// BN254 (alt_bn128) scalar field modulus - the field the token_validity
// circuit's Poseidon hashes operate over. Circuit inputs must be reduced
// into this field.
const BN254_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// Domain separator for deriving a commitment salt from the token itself
// (see deriveSaltField) rather than generating and having to separately
// store/transmit a random salt. Arbitrary fixed constant, distinct from
// any real token/challenge value.
const SALT_DOMAIN_SEPARATOR = 0x53414c545f444f4d41494e5f5632n % BN254_SCALAR_FIELD;

let poseidonPromise: Promise<any> | null = null;
function getPoseidon() {
  if (!poseidonPromise) poseidonPromise = buildPoseidon();
  return poseidonPromise;
}

// Reduces an arbitrary base64 string (a voting token from
// generateVotingToken, or a challenge from generateChallenge - both are
// base64-encoded random bytes) into a BN254 field element usable as a
// circuit input signal.
function stringToFieldElement(value: string): bigint {
  const bytes = Buffer.from(value, 'base64');
  const asBigInt = BigInt('0x' + bytes.toString('hex'));
  return asBigInt % BN254_SCALAR_FIELD;
}

// Derives the commitment salt deterministically from the token, so the
// voter only ever needs to hold onto the token itself (no separate salt
// to store or transmit) to reproduce the same commitment across
// multiple proofs.
async function deriveSaltField(tokenField: bigint): Promise<bigint> {
  const poseidon = await getPoseidon();
  return BigInt(poseidon.F.toString(poseidon([tokenField, SALT_DOMAIN_SEPARATOR])));
}

// Computes the public Poseidon(tokenPreimage, salt) commitment for a
// token - this is what a verifier stores at token-issuance time and
// checks a later proof against, without ever seeing the token itself.
export async function computeTokenCommitment(token: string): Promise<string> {
  const poseidon = await getPoseidon();
  const tokenField = stringToFieldElement(token);
  const saltField = await deriveSaltField(tokenField);
  return poseidon.F.toString(poseidon([tokenField, saltField]));
}

// SECURITY: Constants per NIST recommendations
const PBKDF2_ITERATIONS = 210000; // OWASP 2024 recommendation
const SALT_LENGTH = 32; // 256 bits
const KEY_LENGTH = 64; // 512 bits for post-quantum margin

// Threshold crypto constants
const SHAMIR_THRESHOLD = 3; // K-of-N: need 3 of 5 key shares
const SHAMIR_TOTAL_SHARES = 5;

// Rate limiting (THINTHREAD-inspired)
const MAX_AUTH_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

// Blockchain anchoring
const BLOCKCHAIN_ANCHOR_INTERVAL = 100; // Anchor every 100 votes

export interface KeyPair {
  publicKey: string;
  privateKey: string;
  algorithm: string; // Algorithm agility
  created: number; // Timestamp
}

export interface EncryptedVote {
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey: string;
  version: string;
  algorithm: string;
  timestamp: number;
}

export interface ZKProof {
  proof: string;
  publicInputs: string[];
  curve: string; // bn128, bls12-381
  protocol: string; // groth16, plonk
  version: string;
}

export interface MerkleProof {
  root: string;
  proof: string[]; // display/size only - verifyProof checks `siblings`, not this
  leaf: string;
  index: number;
  algorithm: string;
  siblings: { left: boolean; hash: string; empty?: boolean }[]; // empty: node promoted unchanged (odd level), not a hashed pair
}

export interface ThresholdKeyShare {
  share: string;
  index: number;
  threshold: number;
  totalShares: number;
  commitment: string; // Verification commitment
}

export interface BlockchainAnchor {
  merkleRoot: string;
  /** true only if this anchor was actually submitted to and confirmed by
   * a real chain. See docs/cryptography.md, "On the blockchain anchor". */
  real: boolean;
  blockNumber: number | null;
  transactionHash: string | null;
  /** Always present: a local commitment digest, independent of whether a
   * real chain transaction exists. This is what verification should check
   * today, since `real` is currently always false. */
  localCommitment: string;
  blockchain: string; // ethereum, hyperledger, etc - the *intended* target chain
  timestamp: number;
}

export interface DAGNode {
  id: string;
  hash: string;
  parents: string[]; // Multiple parents (DAG structure)
  timestamp: number;
  data: string;
}

/**
 * Generate Ed25519 key pair with metadata
 * SECURITY: NaCl implementation (libsodium)
 */
export function generateKeyPair(): KeyPair {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: naclUtil.encodeBase64(keyPair.publicKey),
    privateKey: naclUtil.encodeBase64(keyPair.secretKey),
    algorithm: 'ed25519',
    created: Date.now(),
  };
}

/**
 * Generate election key pair (NaCl box)
 */
export function generateElectionKeyPair(): KeyPair {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: naclUtil.encodeBase64(keyPair.publicKey),
    privateKey: naclUtil.encodeBase64(keyPair.secretKey),
    algorithm: 'curve25519-xsalsa20-poly1305',
    created: Date.now(),
  };
}

/**
 * Shamir Secret Sharing - Split private key into N shares
 * SECURITY: Requires K shares to reconstruct
 * ENTERPRISE: Election officials each get one share
 * 
 * @param {string} secret - Private key to split
 * @param {number} threshold - Minimum shares needed (K)
 * @param {number} numShares - Total shares to create (N)
 * @returns {ThresholdKeyShare[]} Array of key shares
 */
export function splitSecretShamir(
  secret: string,
  threshold: number = SHAMIR_THRESHOLD,
  numShares: number = SHAMIR_TOTAL_SHARES
): ThresholdKeyShare[] {
  // Simplified Shamir Secret Sharing
  // PRODUCTION: Use secrets.js-grempe or @stablelib/secret-sharing
  
  const secretBytes = Buffer.from(secret, 'base64');
  const shares: ThresholdKeyShare[] = [];
  
  // Generate random polynomial coefficients
  const coefficients: Buffer[] = [secretBytes];
  for (let i = 1; i < threshold; i++) {
    coefficients.push(randomBytes(secretBytes.length));
  }
  
  // Evaluate polynomial at different points
  for (let shareIndex = 1; shareIndex <= numShares; shareIndex++) {
    const x = shareIndex;
    const y = Buffer.alloc(secretBytes.length);
    
    // y = f(x) = a0 + a1*x + a2*x^2 + ... (in GF(256))
    for (let byteIdx = 0; byteIdx < secretBytes.length; byteIdx++) {
      let acc = 0;
      for (let coeffIdx = 0; coeffIdx < threshold; coeffIdx++) {
        const coeff = coefficients[coeffIdx][byteIdx];
        acc ^= gfMultiply(coeff, gfPower(x, coeffIdx));
      }
      y[byteIdx] = acc;
    }
    
    // Create commitment for verification
    const commitment = sha3_256(y.toString('hex') + shareIndex.toString());
    
    shares.push({
      share: y.toString('base64'),
      index: shareIndex,
      threshold,
      totalShares: numShares,
      commitment,
    });
  }
  
  return shares;
}

/**
 * Reconstruct secret from K threshold shares
 */
export function reconstructSecretShamir(shares: ThresholdKeyShare[]): string {
  if (shares.length < shares[0].threshold) {
    throw new Error(`Need at least ${shares[0].threshold} shares`);
  }
  
  // Lagrange interpolation in GF(256)
  const shareBuffers = shares.slice(0, shares[0].threshold).map(s => ({
    x: s.index,
    y: Buffer.from(s.share, 'base64'),
  }));
  
  const secretLength = shareBuffers[0].y.length;
  const secret = Buffer.alloc(secretLength);
  
  for (let byteIdx = 0; byteIdx < secretLength; byteIdx++) {
    let acc = 0;
    for (let i = 0; i < shareBuffers.length; i++) {
      let num = 1, den = 1;
      for (let j = 0; j < shareBuffers.length; j++) {
        if (i !== j) {
          num = gfMultiply(num, shareBuffers[j].x);
          den = gfMultiply(den, gfAdd(shareBuffers[j].x, shareBuffers[i].x));
        }
      }
      const lagrange = gfDivide(num, den);
      acc ^= gfMultiply(shareBuffers[i].y[byteIdx], lagrange);
    }
    secret[byteIdx] = acc;
  }
  
  return secret.toString('base64');
}

// Galois Field GF(256) operations for Shamir
function gfAdd(a: number, b: number): number { return a ^ b; }
function gfMultiply(a: number, b: number): number {
  let result = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) result ^= a;
    const hiBitSet = a & 0x80;
    a = (a << 1) & 0xff;
    if (hiBitSet) a ^= 0x1b; // Irreducible polynomial
    b >>= 1;
  }
  return result;
}
function gfPower(base: number, exp: number): number {
  let result = 1;
  for (let i = 0; i < exp; i++) result = gfMultiply(result, base);
  return result;
}
function gfDivide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero');
  return gfMultiply(a, gfInverse(b));
}
function gfInverse(a: number): number {
  if (a === 0) throw new Error('No inverse for 0');
  return gfPower(a, 254); // a^254 = a^-1 in GF(256)
}

/**
 * Generate a voting token. Backed directly by the OS CSPRNG via
 * randomBytes(), with no additional runtime statistical self-test on
 * individual outputs.
 */
export function generateVotingToken(): string {
  const token = randomBytes(32);
  return naclUtil.encodeBase64(token);
}

/**
 * Calculate Shannon entropy (randomness measure) of a byte buffer.
 * Only meaningful for samples much larger than the symbol space (256)
 * being measured - see generateVotingToken's note above for why this
 * isn't used as a per-token self-check.
 */
export function calculateShannonEntropy(data: Buffer): number {
  const freq = new Map<number, number>();
  for (const byte of data) {
    freq.set(byte, (freq.get(byte) || 0) + 1);
  }

  let entropy = 0;
  const len = data.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

/**
 * Hash voting token (constant-time verification)
 */
export function hashVotingToken(token: string): string {
  return sha3_256(token);
}

/**
 * Create identity hash with proper PBKDF2
 * SECURITY: 210,000 iterations (OWASP 2024)
 */
export function createIdentityHash(voterId: string, salt: string): string {
  const hash = pbkdf2Sync(
    voterId,
    Buffer.from(salt),
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha512'
  );
  return hash.toString('hex');
}

/**
 * Encrypt vote with authenticated encryption
 */
export function encryptVote(
  candidateId: string,
  electionPublicKey: string
): EncryptedVote {
  const votePayload = {
    candidateId,
    timestamp: Date.now(),
    nonce: naclUtil.encodeBase64(randomBytes(16)),
    integrity: sha3_256(candidateId),
  };
  
  const message = JSON.stringify(votePayload);
  const messageBytes = naclUtil.decodeUTF8(message);
  const ephemeralKey = nacl.box.keyPair();
  const electionPublicKeyBytes = naclUtil.decodeBase64(electionPublicKey);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  
  const ciphertext = nacl.box(
    messageBytes,
    nonce,
    electionPublicKeyBytes,
    ephemeralKey.secretKey
  );
  
  if (!ciphertext) throw new Error('Encryption failed');
  
  return {
    ciphertext: naclUtil.encodeBase64(ciphertext),
    nonce: naclUtil.encodeBase64(nonce),
    ephemeralPublicKey: naclUtil.encodeBase64(ephemeralKey.publicKey),
    version: 'v2-enhanced',
    algorithm: 'curve25519-xsalsa20-poly1305',
    timestamp: Date.now(),
  };
}

/**
 * Decrypt vote with threshold key reconstruction
 */
export function decryptVote(
  encryptedVote: EncryptedVote,
  electionPrivateKey: string
): string {
  try {
    const ciphertext = naclUtil.decodeBase64(encryptedVote.ciphertext);
    const nonce = naclUtil.decodeBase64(encryptedVote.nonce);
    const ephemeralPublicKey = naclUtil.decodeBase64(encryptedVote.ephemeralPublicKey);
    const privateKeyBytes = naclUtil.decodeBase64(electionPrivateKey);
    
    const decrypted = nacl.box.open(ciphertext, nonce, ephemeralPublicKey, privateKeyBytes);
    if (!decrypted) throw new Error('Decryption failed');
    
    const message = naclUtil.encodeUTF8(decrypted);
    const votePayload = JSON.parse(message);
    
    // Verify integrity hash
    const expectedIntegrity = sha3_256(votePayload.candidateId);
    if (votePayload.integrity !== expectedIntegrity) {
      throw new Error('Integrity check failed');
    }
    
    // Verify timestamp
    const now = Date.now();
    const voteAge = now - votePayload.timestamp;
    if (voteAge < 0 || voteAge > 365 * 24 * 60 * 60 * 1000) {
      throw new Error('Timestamp invalid');
    }
    
    return votePayload.candidateId;
  } catch {
    throw new Error('Decryption failed');
  }
}

/**
 * ZK-SNARK PROOF GENERATION - PRODUCTION GROTH16
 * ================================================
 * Uses snarkjs with proper Circom circuits
 * 
 * SECURITY: Requires trusted setup ceremony (MPC)
 * Circuit: token_validity.circom
 * Proving system: Groth16 (fastest verification)
 * 
 * @param witness - Private inputs (token, salt)
 * @param provingKey - zkey from trusted setup (null = fallback)
 * @param circuit - Circuit identifier
 * @returns ZKProof - Groth16 proof
 */
export async function generateZKProof(
  witness: any,
  provingKey: any,
  circuit: string
): Promise<ZKProof> {
  // Real Groth16 path: only wired up for circuits that have actually been
  // compiled and gone through a trusted setup (currently just
  // 'token_validity' - see circuits/token_validity.circom and
  // circuits/README.md for how the proving/verification artifacts under
  // circuits/build/ were generated).
  const circuitPath = `./circuits/build/${circuit}_js/${circuit}.wasm`;
  const zkeyPath = `./circuits/build/${circuit}.zkey`;

  const fs = require('fs');
  const path = require('path');

  if (fs.existsSync(path.resolve(circuitPath)) && fs.existsSync(path.resolve(zkeyPath))) {
    const { proof, publicSignals } = await groth16.fullProve(
      witness,
      path.resolve(circuitPath),
      path.resolve(zkeyPath)
    );

    return {
      proof: JSON.stringify(proof),
      publicInputs: publicSignals,
      curve: 'bn128',
      protocol: 'groth16',
      version: 'snarkjs-0.7.x',
    };
  }

  // FALLBACK (not zero-knowledge): used only for circuits that don't have
  // compiled artifacts yet, e.g. 'vote-validity'. This is a commitment,
  // not a proof of knowledge - it must not be presented as a Groth16
  // proof to a caller expecting real ZK guarantees.
  const witnessHash = sha3_512(JSON.stringify(witness));
  const commitment = sha3_256(witnessHash + circuit);
  const challenge = sha3_256(commitment + witnessHash);
  const response = sha3_512(challenge + witnessHash + circuit);

  return {
    proof: response.substring(0, 64),
    publicInputs: [commitment],
    curve: 'bn128',
    protocol: 'fiat-shamir-fallback',
    version: 'uncompiled-circuit',
  };
}

/**
 * Verify a ZK proof. For 'groth16' proofs this performs real pairing-based
 * Groth16 verification against the compiled verification key. Proofs
 * produced by the fiat-shamir-fallback path (see generateZKProof) are
 * rejected here - they were never zero-knowledge and can't be verified
 * as such.
 *
 * @param proof - ZKProof from generateZKProof
 * @param publicInputs - Expected public signals (e.g. the token commitment)
 * @returns boolean - Proof validity
 */
export async function verifyZKProof(
  proof: ZKProof,
  publicInputs: string[],
  circuit: string = 'token_validity'
): Promise<boolean> {
  if (proof.protocol !== 'groth16') return false;

  const vkeyPath = `./circuits/build/${circuit}_verification_key.json`;
  const fs = require('fs');
  const path = require('path');

  if (!fs.existsSync(path.resolve(vkeyPath))) return false;

  try {
    const vkey = JSON.parse(fs.readFileSync(path.resolve(vkeyPath), 'utf-8'));
    const groth16Proof = JSON.parse(proof.proof);
    return await groth16.verify(vkey, publicInputs, groth16Proof);
  } catch (error) {
    console.warn('Groth16 verify failed:', error);
    return false;
  }
}

/**
 * Generate a real Groth16 zero-knowledge proof of token validity: proves
 * knowledge of a voting token whose salted Poseidon commitment matches a
 * public value, without revealing the token. See circuits/token_validity.circom.
 *
 * The proof's public signals (in order) are:
 *   [validityFlag, nullifier, tokenHashCommitment, challengeHash]
 * `nullifier` is Poseidon(tokenPreimage, challengeHash) as a circuit
 * *output* - the verifier can't recompute it independently (it depends
 * on the secret token), but can check it against previously-seen
 * nullifiers to reject a replayed proof. This library doesn't persist
 * seen nullifiers itself (no storage layer wired up) - callers that want
 * replay protection should track `proof.publicInputs[1]` themselves.
 *
 * @param token - Voting token (secret)
 * @param challenge - Freshness nonce from verifier, bound into the proof
 * @returns ZKProof - real Groth16 proof, or the fiat-shamir fallback if
 *   the circuit hasn't been compiled in this environment
 */
export async function generateTokenValidityProof(token: string, challenge: string): Promise<ZKProof> {
  const tokenField = stringToFieldElement(token);
  const saltField = await deriveSaltField(tokenField);
  const challengeField = stringToFieldElement(challenge);
  const poseidon = await getPoseidon();
  const tokenHashCommitment = poseidon.F.toString(poseidon([tokenField, saltField]));

  const witness = {
    tokenHashCommitment,
    challengeHash: challengeField.toString(),
    tokenPreimage: tokenField.toString(),
    salt: saltField.toString(),
  };
  return generateZKProof(witness, null, 'token_validity');
}

/**
 * Verify a token validity proof against the token's stored Poseidon
 * commitment (see computeTokenCommitment) and the challenge that was
 * issued for this verification attempt. Confirms the proof's claimed
 * commitment/challenge match what's expected *and* that the underlying
 * Groth16 proof is cryptographically valid - a proof generated for a
 * different token or a different (stale) challenge is rejected before
 * the pairing check even runs.
 */
export async function verifyTokenValidityProof(
  proof: ZKProof,
  expectedCommitment: string,
  expectedChallenge: string
): Promise<boolean> {
  if (proof.publicInputs.length !== 4) return false;
  const [validityFlag, , tokenHashCommitment, challengeHash] = proof.publicInputs;
  const expectedChallengeField = stringToFieldElement(expectedChallenge).toString();

  if (validityFlag !== '1') return false;
  if (!constantTimeEqual(tokenHashCommitment, expectedCommitment)) return false;
  if (!constantTimeEqual(challengeHash, expectedChallengeField)) return false;

  return verifyZKProof(proof, proof.publicInputs);
}

/**
 * Generate vote validity proof (wrapper for generateZKProof).
 * No compiled circuit exists for 'vote-validity' yet, so this currently
 * always returns the fiat-shamir-fallback commitment, not a real proof -
 * see generateZKProof's protocol field to distinguish the two.
 */
export async function generateVoteValidityProof(encryptedVote: EncryptedVote, validCandidateIds: string[]): Promise<string> {
  const witness = { encryptedVote, validCandidateIds };
  const proof = await generateZKProof(witness, null, 'vote-validity');
  return JSON.stringify(proof);
}

// ============================================================================
// ANONYMOUS ELIGIBILITY (see circuits/eligibility.circom, docs/protocol.md
// "Stage: Credential issuance")
// ============================================================================

const ELIGIBILITY_TREE_LEVELS = 20;

// Arbitrary strings (UUIDs, not base64) reduced into the BN254 scalar
// field via SHA3-256 - stringToFieldElement's base64 decoding would
// silently mangle a UUID instead of throwing.
function utf8ToFieldElement(value: string): bigint {
  const hex = sha3_256(value);
  return BigInt('0x' + hex) % BN254_SCALAR_FIELD;
}

// Generates a fresh eligibility credential: a random secret and its
// Poseidon commitment (salt derived from the secret, same pattern as
// computeTokenCommitment - the voter only needs to retain the secret).
export async function generateEligibilityCredential(): Promise<{ secret: string; commitment: string }> {
  const secret = naclUtil.encodeBase64(randomBytes(32));
  const commitment = await computeEligibilityCommitment(secret);
  return { secret, commitment };
}

export async function computeEligibilityCommitment(secret: string): Promise<string> {
  const poseidon = await getPoseidon();
  const secretField = stringToFieldElement(secret);
  const saltField = await deriveSaltField(secretField);
  return poseidon.F.toString(poseidon([secretField, saltField]));
}

export class PoseidonMerkleTree {
  private levels: number;
  private zeroHashes: bigint[] = [];
  private realLayers: bigint[][] = [];
  private ready: Promise<void>;

  constructor(leaves: string[], levels: number = ELIGIBILITY_TREE_LEVELS) {
    this.levels = levels;
    this.ready = this.build(leaves.map(l => BigInt(l)));
  }

  private async build(leaves: bigint[]): Promise<void> {
    const poseidon = await getPoseidon();
    const hash2 = (a: bigint, b: bigint) => BigInt(poseidon.F.toString(poseidon([a, b])));

    this.zeroHashes = [0n];
    for (let i = 0; i < this.levels; i++) {
      this.zeroHashes.push(hash2(this.zeroHashes[i], this.zeroHashes[i]));
    }

    this.realLayers = [leaves];
    let current = leaves;
    for (let level = 0; level < this.levels && current.length > 1; level++) {
      const next: bigint[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i];
        const right = i + 1 < current.length ? current[i + 1] : this.zeroHashes[level];
        next.push(hash2(left, right));
      }
      this.realLayers.push(next);
      current = next;
    }
  }

  async getRoot(): Promise<string> {
    await this.ready;
    const topLevel = this.realLayers.length - 1;
    let hash = this.realLayers[topLevel][0] ?? this.zeroHashes[0];
    const poseidon = await getPoseidon();
    for (let level = topLevel; level < this.levels; level++) {
      hash = BigInt(poseidon.F.toString(poseidon([hash, this.zeroHashes[level]])));
    }
    return hash.toString();
  }

  async getProof(index: number): Promise<{ pathElements: string[]; pathIndices: number[] }> {
    await this.ready;
    const pathElements: string[] = [];
    const pathIndices: number[] = [];
    let idx = index;

    for (let level = 0; level < this.realLayers.length - 1; level++) {
      const layer = this.realLayers[level];
      const isRight = idx % 2 === 1;
      const siblingIdx = isRight ? idx - 1 : idx + 1;
      const sibling = siblingIdx < layer.length ? layer[siblingIdx] : this.zeroHashes[level];
      pathElements.push(sibling.toString());
      pathIndices.push(isRight ? 1 : 0);
      idx = Math.floor(idx / 2);
    }

    // Above the point where real leaves collapse to a single node, this
    // branch is always the left side of an otherwise-empty subtree.
    for (let level = this.realLayers.length - 1; level < this.levels; level++) {
      pathElements.push(this.zeroHashes[level].toString());
      pathIndices.push(0);
    }

    return { pathElements, pathIndices };
  }
}

/**
 * Generate a real Groth16 proof of anonymous eligibility: proves
 * membership of `secret`'s commitment in the tree at `merkleRoot` without
 * revealing which leaf, and outputs a nullifier bound to `electionId`. See
 * circuits/eligibility.circom.
 *
 * Public signals (in order): [nullifier, merkleRoot, electionId]
 */
export async function generateEligibilityProof(
  secret: string,
  electionId: string,
  merkleRoot: string,
  pathElements: string[],
  pathIndices: number[]
): Promise<ZKProof> {
  const secretField = stringToFieldElement(secret);
  const saltField = await deriveSaltField(secretField);
  const electionField = utf8ToFieldElement(electionId);

  const witness = {
    merkleRoot,
    electionId: electionField.toString(),
    secret: secretField.toString(),
    salt: saltField.toString(),
    pathElements,
    pathIndices,
  };
  return generateZKProof(witness, null, 'eligibility');
}

/**
 * Verify an eligibility proof against the election's current eligibility
 * root and electionId. Returns the nullifier on success so the caller can
 * check/record it, or null if the proof doesn't verify.
 */
export async function verifyEligibilityProof(
  proof: ZKProof,
  expectedRoot: string,
  electionId: string
): Promise<string | null> {
  if (proof.publicInputs.length !== 3) return null;
  const [nullifier, merkleRoot, electionField] = proof.publicInputs;
  const expectedElectionField = utf8ToFieldElement(electionId).toString();

  if (!constantTimeEqual(merkleRoot, expectedRoot)) return null;
  if (!constantTimeEqual(electionField, expectedElectionField)) return null;

  const valid = await verifyZKProof(proof, proof.publicInputs, 'eligibility');
  return valid ? nullifier : null;
}

/**
 * Sign data with Ed25519
 */
export function signData(data: string, privateKey: string): string {
  const dataBytes = naclUtil.decodeUTF8(data);
  const privateKeyBytes = naclUtil.decodeBase64(privateKey);
  const signature = nacl.sign.detached(dataBytes, privateKeyBytes);
  return naclUtil.encodeBase64(signature);
}

/**
 * Derive the Ed25519 public key that corresponds to a given private key.
 * nacl's sign secret key format already contains the public key (it's a
 * 64-byte seed+publicKey pair), so this is exact, not a re-derivation from
 * scratch. Use this - never a freshly generated unrelated keypair - when a
 * caller needs "the public key for this private key" (see createLedgerEntry
 * in utils/audit.ts, which stores the public key derived from the signing
 * key so the stored signature verifies against its own record).
 */
export function derivePublicKey(privateKey: string): string {
  const secretKeyBytes = naclUtil.decodeBase64(privateKey);
  const keyPair = nacl.sign.keyPair.fromSecretKey(secretKeyBytes);
  return naclUtil.encodeBase64(keyPair.publicKey);
}

/**
 * Verify Ed25519 signature
 */
export function verifySignature(data: string, signature: string, publicKey: string): boolean {
  try {
    const dataBytes = naclUtil.decodeUTF8(data);
    const signatureBytes = naclUtil.decodeBase64(signature);
    const publicKeyBytes = naclUtil.decodeBase64(publicKey);
    return nacl.sign.detached.verify(dataBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Create receipt hash
 */
export function createReceiptHash(voteData: string): string {
  const salt = randomBytes(16).toString('hex');
  return sha3_256(voteData + salt);
}

/**
 * Merkle tree, domain-separated per docs/cryptography.md (see
 * docs/protocol.md, "Stage: Ballot inclusion" for the write-up).
 *
 * 1. Leaves and internal nodes are hashed under different domain tags
 *    (ELECTION_MERKLE_LEAF vs ELECTION_MERKLE_NODE), preventing the classic
 *    Merkle second-preimage weakness that RFC 6962 exists to prevent (an
 *    attacker-crafted value hashed as a "leaf" could otherwise be confused
 *    with a legitimate internal node hash, or vice versa).
 * 2. An unpaired node at an odd-length level is promoted unchanged to the
 *    next level instead of being duplicated and hashed with itself, which
 *    avoids the CVE-2012-2459-class duplicate-node issue (hashing a node
 *    with itself lets an attacker pad the leaf set in a way that produces
 *    a colliding root for two different leaf sequences in some tree
 *    shapes).
 */
export class MerkleTree {
  private leaves: string[];
  private tree: string[][];

  constructor(leaves: string[]) {
    if (leaves.length === 0) throw new Error('Empty tree');
    this.leaves = leaves.map(leaf => domainHashRaw(DOMAIN.ELECTION_MERKLE_LEAF, leaf));
    this.tree = this.buildTree();
  }

  private buildTree(): string[][] {
    const tree: string[][] = [this.leaves];

    while (tree[tree.length - 1].length > 1) {
      const currentLevel = tree[tree.length - 1];
      const nextLevel: string[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          const left = currentLevel[i];
          const right = currentLevel[i + 1];
          nextLevel.push(domainHashRaw(DOMAIN.ELECTION_MERKLE_NODE, left + right));
        } else {
          // Odd node out: promote unchanged rather than hashing it with
          // itself (see class doc comment above).
          nextLevel.push(currentLevel[i]);
        }
      }

      tree.push(nextLevel);
    }

    return tree;
  }

  getRoot(): string {
    return this.tree[this.tree.length - 1][0];
  }

  getProof(index: number): MerkleProof {
    if (index < 0 || index >= this.leaves.length) {
      throw new Error('Index out of bounds');
    }

    const proof: string[] = [];
    const siblings: { left: boolean; hash: string; empty?: boolean }[] = [];
    let currentIndex = index;

    for (let level = 0; level < this.tree.length - 1; level++) {
      const currentLevel = this.tree[level];
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
      const hasSibling = siblingIndex < currentLevel.length;

      const siblingHash = hasSibling ? currentLevel[siblingIndex] : '';

      proof.push(siblingHash);
      siblings.push({
        // true when the sibling sits to the left, i.e. the current node is the right child
        left: isRightNode,
        hash: siblingHash,
        empty: !hasSibling,
      });

      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      root: this.getRoot(),
      proof,
      leaf: this.leaves[index],
      index,
      algorithm: 'sha3-256-domain-separated',
      siblings,
    };
  }

  static verifyProof(merkleProof: MerkleProof): boolean {
    let hash = merkleProof.leaf;
    let index = merkleProof.index;

    for (const sibling of merkleProof.siblings) {
      if (!sibling.empty) {
        hash = sibling.left
          ? domainHashRaw(DOMAIN.ELECTION_MERKLE_NODE, sibling.hash + hash)
          : domainHashRaw(DOMAIN.ELECTION_MERKLE_NODE, hash + sibling.hash);
      }
      // empty step: node was promoted unchanged, hash carries forward as-is
      index = Math.floor(index / 2);
    }

    const hashBuffer = Buffer.from(hash);
    const rootBuffer = Buffer.from(merkleProof.root);
    return hashBuffer.length === rootBuffer.length && timingSafeEqual(hashBuffer, rootBuffer);
  }
}

/**
 * DAG (Directed Acyclic Graph) for vote dependencies
 * ENTERPRISE: Provides partial ordering and conflict detection
 */
export class VoteDAG {
  private nodes: Map<string, DAGNode> = new Map();
  
  addNode(id: string, data: string, parents: string[]): DAGNode {
    // Verify parents exist
    for (const parent of parents) {
      if (!this.nodes.has(parent) && parent !== 'genesis') {
        throw new Error(`Parent ${parent} not found`);
      }
    }
    
    const node: DAGNode = {
      id,
      hash: sha3_256(data + parents.join(',')),
      parents,
      timestamp: Date.now(),
      data,
    };
    
    this.nodes.set(id, node);
    return node;
  }
  
  getNode(id: string): DAGNode | undefined {
    return this.nodes.get(id);
  }
  
  // Detect cycles (should never happen in valid DAG)
  hasCycle(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const node = this.nodes.get(nodeId);
      if (!node) return false;
      
      for (const parent of node.parents) {
        if (parent === 'genesis') continue;
        if (!visited.has(parent)) {
          if (dfs(parent)) return true;
        } else if (recursionStack.has(parent)) {
          return true; // Cycle detected
        }
      }
      
      recursionStack.delete(nodeId);
      return false;
    };
    
    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) return true;
      }
    }
    
    return false;
  }
}

/**
 * Constant-time comparison
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Hash IP address with daily salt (THINTHREAD-inspired)
 */
export function hashIPAddress(ipAddress: string, dailySalt: string): string {
  return sha3_256(ipAddress + dailySalt);
}

/**
 * Compute a local commitment digest for a Merkle root, in the shape a real
 * chain anchor would eventually fill in. This does NOT submit anything to
 * Ethereum, Hyperledger, or any other chain - `real` is always `false` and
 * `blockNumber`/`transactionHash` are always `null` until actual chain
 * integration exists. See docs/cryptography.md, "On the blockchain
 * anchor" - the localCommitment field is what verification should check
 * today; treating this as a real transaction receipt would be exactly the
 * security-theater pattern that document warns against.
 */
export function generateBlockchainAnchor(
  merkleRoot: string,
  blockchain: string = 'ethereum'
): BlockchainAnchor {
  return {
    merkleRoot,
    real: false,
    blockNumber: null,
    transactionHash: null,
    localCommitment: domainHashRaw(DOMAIN.ELECTION_LEDGER, merkleRoot + ':' + Date.now().toString()),
    blockchain,
    timestamp: Date.now(),
  };
}

// @ts-ignore - opentimestamps ships incomplete/mismatched TS definitions for some exports
const OpenTimestamps = require('opentimestamps');

/**
 * Real external timestamp anchoring via OpenTimestamps (see
 * docs/cryptography.md, "On the external timestamp anchor"). This submits
 * a hash to live, independent timestamp calendar servers
 * (a.pool.opentimestamps.org and others), which aggregate many submitted
 * hashes into a Merkle tree and periodically commit the aggregate root
 * into a public, tamper-evident ledger maintained entirely outside this
 * project's control. This is a real, widely-used, free timestamping
 * service - not a simulation, and no financial transaction, wallet, token,
 * or monetary value of any kind is involved on this project's side; it
 * uses that public ledger purely as a clock, the same way a notary uses a
 * dated newspaper to prove a document existed by a certain day. Anchoring
 * is asynchronous by nature (typically hours), so a freshly submitted
 * anchor starts in a pending state and must be upgraded later via
 * checkTimestampAnchor() once the public ledger has confirmed it.
 *
 * @param data - the string to anchor (e.g. a finalization manifestHash).
 *   This function computes a real SHA-256 of it internally - the OTS proof
 *   is explicitly tagged OpSHA256, so it must actually contain a SHA-256
 *   digest, not e.g. this codebase's usual SHA3-256 passed through
 *   unchanged (mislabeling the algorithm inside the proof would make the
 *   anchor unverifiable by any independent, spec-following OTS client).
 * @returns base64-encoded .ots proof file - store this; it's required to
 *   later check/upgrade confirmation status and to independently verify
 *   the anchor without trusting this server.
 */
export async function submitTimestampAnchor(data: string): Promise<{ otsProofBase64: string; submittedAt: number; anchoredSha256: string }> {
  const hashBytes = createHash('sha256').update(data).digest();
  const detached = OpenTimestamps.DetachedTimestampFile.fromHash(new OpenTimestamps.Ops.OpSHA256(), hashBytes);
  await OpenTimestamps.stamp(detached);
  const proofBytes: Uint8Array = detached.serializeToBytes();
  return {
    otsProofBase64: Buffer.from(proofBytes).toString('base64'),
    submittedAt: Date.now(),
    anchoredSha256: hashBytes.toString('hex'),
  };
}

/**
 * Check/upgrade a previously-submitted anchor's confirmation status.
 * Attempts to fetch a completed attestation from the calendar servers
 * (this succeeds once the aggregate root has actually been committed into
 * the public ledger); returns whether it's confirmed yet, honestly - most
 * calls in the hours after submission will correctly report unconfirmed,
 * which is expected, not an error.
 */
export async function checkTimestampAnchor(otsProofBase64: string): Promise<{
  confirmed: boolean;
  detail: string;
  upgradedProofBase64?: string;
}> {
  const proofBytes = Buffer.from(otsProofBase64, 'base64');
  const detached = OpenTimestamps.DetachedTimestampFile.deserialize(proofBytes);

  let upgraded = false;
  try {
    upgraded = await OpenTimestamps.upgrade(detached);
  } catch {
    upgraded = false;
  }

  const info: string = OpenTimestamps.info(detached);
  const confirmed = /BlockHeaderAttestation/i.test(info) || /attests/i.test(info);

  return {
    confirmed,
    detail: info,
    ...(upgraded ? { upgradedProofBase64: Buffer.from(detached.serializeToBytes()).toString('base64') } : {}),
  };
}

/**
 * Generate challenge
 */
export function generateChallenge(): string {
  return naclUtil.encodeBase64(randomBytes(32));
}

export default {
  generateKeyPair,
  generateElectionKeyPair,
  splitSecretShamir,
  reconstructSecretShamir,
  generateVotingToken,
  computeTokenCommitment,
  hashVotingToken,
  createIdentityHash,
  encryptVote,
  decryptVote,
  generateZKProof,
  verifyZKProof,
  generateTokenValidityProof,
  verifyTokenValidityProof,
  generateVoteValidityProof,
  signData,
  verifySignature,
  derivePublicKey,
  createReceiptHash,
  MerkleTree,
  VoteDAG,
  constantTimeEqual,
  hashIPAddress,
  generateBlockchainAnchor,
  submitTimestampAnchor,
  checkTimestampAnchor,
  generateChallenge,
};





