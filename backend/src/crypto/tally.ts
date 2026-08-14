/**
 * Homomorphic tally: exponential (lifted) EC ElGamal over secp256k1, with
 * real Shamir threshold decryption (Pedersen-style: trustees never
 * reconstruct the private key, only combine partial decryptions on the
 * ciphertext side via Lagrange interpolation in the exponent), and
 * Chaum-Pedersen NIZK proofs that each partial decryption was computed
 * honestly from a trustee's committed share. See docs/protocol.md,
 * "Stage: Tally".
 *
 * This is a different Shamir construction from splitSecretShamir/
 * reconstructSecretShamir in engine.ts, which operate byte-wise (GF(256))
 * and are built for recovering a secret's original bytes. Threshold
 * decryption needs shares that are polynomial evaluations mod the curve's
 * scalar field order, so partial decryptions computed per-share can be
 * combined into a group-element result without ever reconstructing the
 * scalar - a genuinely different (and here, genuinely non-custodial)
 * property.
 */

import { createHash, randomBytes } from 'crypto';
const EC = require('elliptic').ec;

const ec = new EC('secp256k1');
const CURVE_ORDER = BigInt('0x' + ec.n.toString(16));

export interface ECPointHex {
  x: string;
  y: string;
}

export interface ElGamalCiphertext {
  c1: ECPointHex;
  c2: ECPointHex;
}

export interface TallyKeyShare {
  index: number;
  value: string; // hex scalar mod CURVE_ORDER
  publicCommitment: ECPointHex; // value * G, published so partial decryptions can be checked against it
}

export interface ChaumPedersenProof {
  commitmentA: ECPointHex; // w*G
  commitmentB: ECPointHex; // w*C1
  response: string; // hex scalar: w + c*share mod n
}

export interface PartialDecryption {
  index: number;
  point: ECPointHex; // share_i * C1
  proof: ChaumPedersenProof;
}

function mod(a: bigint, m: bigint): bigint {
  const r = a % m;
  return r >= 0n ? r : r + m;
}

function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [mod(a, m), m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r !== 1n) throw new Error('Not invertible');
  return mod(old_s, m);
}

function randomScalar(): bigint {
  // Rejection sampling to avoid modulo bias against CURVE_ORDER.
  let value: bigint;
  do {
    value = BigInt('0x' + randomBytes(32).toString('hex'));
  } while (value === 0n || value >= CURVE_ORDER);
  return value;
}

// The identity/point-at-infinity is a real, legitimate value here (e.g. a
// candidate with zero votes decrypts to it before the discrete-log step) -
// elliptic's Point.getX()/getY() throw on it rather than returning null,
// so it needs an explicit sentinel encoding rather than being routed
// through the normal x/y hex path.
const INFINITY_SENTINEL = 'inf';

function pointToHex(point: any): ECPointHex {
  if (point.isInfinity()) return { x: INFINITY_SENTINEL, y: INFINITY_SENTINEL };
  return { x: point.getX().toString(16), y: point.getY().toString(16) };
}

function pointFromHex(p: ECPointHex): any {
  if (p.x === INFINITY_SENTINEL) return ec.curve.point(null, null);
  return ec.curve.point(p.x, p.y);
}

function scalarToHex(s: bigint): string {
  return s.toString(16);
}

// Fiat-Shamir challenge for the Chaum-Pedersen proof, binding all public
// values so the proof can't be replayed against a different statement.
function fiatShamirChallenge(...points: ECPointHex[]): bigint {
  const hash = createHash('sha256');
  for (const p of points) hash.update(p.x + ':' + p.y);
  return mod(BigInt('0x' + hash.digest('hex')), CURVE_ORDER);
}

export function generateTallyKeyPair(): { privateKey: string; publicKey: ECPointHex } {
  const privateKey = randomScalar();
  const publicKey = ec.g.mul(privateKey.toString(16));
  return { privateKey: scalarToHex(privateKey), publicKey: pointToHex(publicKey) };
}

/**
 * Split a private scalar into K-of-N Shamir shares over Z_(curve order),
 * with each share's public commitment (share * G) published alongside it -
 * this is what lets a partial decryption be checked (via Chaum-Pedersen)
 * against a specific trustee's share without that share ever being
 * revealed or the full private key ever being reconstructed.
 */
export function splitScalarShamir(privateKeyHex: string, threshold: number, totalShares: number): TallyKeyShare[] {
  if (threshold < 1 || threshold > totalShares) throw new Error('Invalid threshold');
  const secret = mod(BigInt('0x' + privateKeyHex), CURVE_ORDER);

  const coefficients = [secret];
  for (let i = 1; i < threshold; i++) coefficients.push(randomScalar());

  const shares: TallyKeyShare[] = [];
  for (let x = 1; x <= totalShares; x++) {
    let y = 0n;
    let xPow = 1n;
    for (const coeff of coefficients) {
      y = mod(y + coeff * xPow, CURVE_ORDER);
      xPow = mod(xPow * BigInt(x), CURVE_ORDER);
    }
    shares.push({
      index: x,
      value: scalarToHex(y),
      publicCommitment: pointToHex(ec.g.mul(y.toString(16))),
    });
  }
  return shares;
}

function lagrangeCoefficientAtZero(index: number, allIndices: number[]): bigint {
  let num = 1n;
  let den = 1n;
  for (const j of allIndices) {
    if (j === index) continue;
    num = mod(num * BigInt(-j), CURVE_ORDER);
    den = mod(den * BigInt(index - j), CURVE_ORDER);
  }
  return mod(num * modInverse(den, CURVE_ORDER), CURVE_ORDER);
}

/**
 * Exponential ElGamal encryption of a single bit (0 or 1), one-hot per
 * candidate slot. Encrypts bit*G rather than the bit directly - additively
 * homomorphic (summing ciphertexts sums the encrypted bits), at the cost
 * of needing a bounded discrete-log solve to decrypt the final sum.
 */
export function encryptBit(bit: 0 | 1, publicKey: ECPointHex): ElGamalCiphertext {
  const r = randomScalar();
  const pk = pointFromHex(publicKey);
  const c1 = ec.g.mul(r.toString(16));
  const rPk = pk.mul(r.toString(16));
  const bitPoint = bit === 1 ? ec.g : ec.g.mul('0');
  const c2 = rPk.add(bitPoint);
  return { c1: pointToHex(c1), c2: pointToHex(c2) };
}

/** One ciphertext per candidate, encrypting 1 at `choiceIndex` and 0 elsewhere. */
export function encryptOneHot(choiceIndex: number, numCandidates: number, publicKey: ECPointHex): ElGamalCiphertext[] {
  if (choiceIndex < 0 || choiceIndex >= numCandidates) throw new Error('choiceIndex out of range');
  const out: ElGamalCiphertext[] = [];
  for (let i = 0; i < numCandidates; i++) {
    out.push(encryptBit(i === choiceIndex ? 1 : 0, publicKey));
  }
  return out;
}

/** Sums ciphertexts via EC point addition - the core homomorphic step. */
export function homomorphicSum(ciphertexts: ElGamalCiphertext[]): ElGamalCiphertext {
  if (ciphertexts.length === 0) throw new Error('Cannot sum zero ciphertexts');
  let c1 = pointFromHex(ciphertexts[0].c1);
  let c2 = pointFromHex(ciphertexts[0].c2);
  for (let i = 1; i < ciphertexts.length; i++) {
    c1 = c1.add(pointFromHex(ciphertexts[i].c1));
    c2 = c2.add(pointFromHex(ciphertexts[i].c2));
  }
  return { c1: pointToHex(c1), c2: pointToHex(c2) };
}

/**
 * One trustee's partial decryption of a ciphertext, plus a Chaum-Pedersen
 * proof that `point = share * ciphertext.c1` used the same share as their
 * published `publicCommitment = share * G` - verifiable by anyone without
 * learning the share.
 */
export function computePartialDecryption(share: TallyKeyShare, ciphertext: ElGamalCiphertext): PartialDecryption {
  const shareScalar = mod(BigInt('0x' + share.value), CURVE_ORDER);
  const c1 = pointFromHex(ciphertext.c1);
  const point = c1.mul(shareScalar.toString(16));

  const w = randomScalar();
  const commitmentA = ec.g.mul(w.toString(16));
  const commitmentB = c1.mul(w.toString(16));
  const challenge = fiatShamirChallenge(share.publicCommitment, pointToHex(point), pointToHex(commitmentA), pointToHex(commitmentB));
  const response = mod(w + challenge * shareScalar, CURVE_ORDER);

  return {
    index: share.index,
    point: pointToHex(point),
    proof: {
      commitmentA: pointToHex(commitmentA),
      commitmentB: pointToHex(commitmentB),
      response: scalarToHex(response),
    },
  };
}

/** Verifies a partial decryption's Chaum-Pedersen proof without needing the share. */
export function verifyPartialDecryption(
  publicCommitment: ECPointHex,
  ciphertext: ElGamalCiphertext,
  partial: PartialDecryption
): boolean {
  const c1 = pointFromHex(ciphertext.c1);
  const Y = pointFromHex(publicCommitment);
  const D = pointFromHex(partial.point);
  const A = pointFromHex(partial.proof.commitmentA);
  const B = pointFromHex(partial.proof.commitmentB);
  const z = mod(BigInt('0x' + partial.proof.response), CURVE_ORDER);
  const challenge = fiatShamirChallenge(publicCommitment, partial.point, partial.proof.commitmentA, partial.proof.commitmentB);

  const lhs1 = ec.g.mul(z.toString(16));
  const rhs1 = A.add(Y.mul(challenge.toString(16)));
  const lhs2 = c1.mul(z.toString(16));
  const rhs2 = B.add(D.mul(challenge.toString(16)));

  return lhs1.eq(rhs1) && lhs2.eq(rhs2);
}

/**
 * Combines >= threshold verified partial decryptions into x*C1 via
 * Lagrange interpolation in the exponent - no party ever learns x.
 */
export function combinePartialDecryptions(partials: PartialDecryption[]): ECPointHex {
  const indices = partials.map(p => p.index);
  let combined: any = null;
  for (const partial of partials) {
    const lambda = lagrangeCoefficientAtZero(partial.index, indices);
    const term = pointFromHex(partial.point).mul(lambda.toString(16));
    combined = combined === null ? term : combined.add(term);
  }
  return pointToHex(combined);
}

/** Baby-step giant-step discrete log of M = value*G, bounded by maxValue (real ballot counts are small enough for this to be fast). */
export function solveDiscreteLog(point: ECPointHex, maxValue: number): number {
  const target = pointFromHex(point);
  if (target.isInfinity()) return 0;

  const pointKey = (p: any) => (p.isInfinity() ? 'inf' : `${p.getX().toString(16)}:${p.getY().toString(16)}`);

  const m = Math.ceil(Math.sqrt(maxValue + 1));
  const babySteps = new Map<string, number>();
  let current = ec.g.mul('0'); // identity
  for (let j = 0; j <= m; j++) {
    babySteps.set(pointKey(current), j);
    current = j === 0 ? ec.g : current.add(ec.g);
  }

  const negMG = ec.g.mul(m.toString(16)).neg();
  let gamma = target;
  for (let i = 0; i <= m; i++) {
    const key = pointKey(gamma);
    if (babySteps.has(key)) {
      const j = babySteps.get(key)!;
      const result = i * m + j;
      if (result <= maxValue) return result;
    }
    gamma = gamma.add(negMG);
  }
  throw new Error(`Discrete log not found within bound ${maxValue}`);
}

/** Decrypts a homomorphically-summed ciphertext given the combined x*C1, bounded by the known total ballot count. */
export function decryptSum(ciphertext: ElGamalCiphertext, combinedXC1: ECPointHex, maxValue: number): number {
  const c2 = pointFromHex(ciphertext.c2);
  const xC1 = pointFromHex(combinedXC1);
  const m = c2.add(xC1.neg());
  return solveDiscreteLog(pointToHex(m), maxValue);
}

export default {
  generateTallyKeyPair,
  splitScalarShamir,
  encryptBit,
  encryptOneHot,
  homomorphicSum,
  computePartialDecryption,
  verifyPartialDecryption,
  combinePartialDecryptions,
  solveDiscreteLog,
  decryptSum,
};
