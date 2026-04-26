/**
 * CRYPTOGRAPHIC ARCHITECTURE - TECHNICAL WHITEPAPER
 * ==================================================
 * Deep technical documentation for cryptography experts,
 * security auditors, and academic review.
 * 
 * Reading level: Graduate-level cryptography
 * Audience: Security researchers, election officials, regulators
 */

import { useTheme } from '../contexts/ThemeContext';
import './CryptoWhitepaper.css';

export default function CryptoWhitepaper() {
  const { darkMode } = useTheme();

  return (
    <div className={`whitepaper ${darkMode ? 'dark-mode' : ''}`}>
      {/* Title Section */}
      <header className="wp-header">
        <h1>Cryptographic Architecture</h1>
        <p className="wp-subtitle">
          Technical specification for end-to-end verifiable elections
        </p>
        <div className="wp-meta">
          <span>Version 2.1.0</span>
          <span>Last Updated: January 2026</span>
          <span>Classification: Public</span>
        </div>
      </header>

      {/* Table of Contents */}
      <nav className="wp-toc">
        <h2>Contents</h2>
        <ol>
          <li><a href="#abstract">Abstract</a></li>
          <li><a href="#threat-model">Threat Model</a></li>
          <li><a href="#primitives">Cryptographic Primitives</a></li>
          <li><a href="#key-management">Key Management</a></li>
          <li><a href="#vote-encryption">Vote Encryption Protocol</a></li>
          <li><a href="#zero-knowledge">Zero-Knowledge Proofs</a></li>
          <li><a href="#merkle">Merkle Tree Construction</a></li>
          <li><a href="#dag">Directed Acyclic Graph Structure</a></li>
          <li><a href="#consensus">Byzantine Fault Tolerant Consensus</a></li>
          <li><a href="#verification">Universal Verification</a></li>
          <li><a href="#formal">Formal Security Analysis</a></li>
        </ol>
      </nav>

      {/* Abstract */}
      <section id="abstract" className="wp-section">
        <h2>1. Abstract</h2>
        <div className="wp-content">
          <p>
            This document specifies the cryptographic architecture of a trustless voting system 
            designed to achieve <strong>end-to-end verifiability</strong> while preserving 
            <strong>ballot secrecy</strong>. The system employs a combination of elliptic curve 
            cryptography, zero-knowledge proofs, Merkle tree commitments, and a directed acyclic 
            graph (DAG) structure to provide mathematical guarantees that:
          </p>
          <ol className="wp-list">
            <li>Every valid vote is recorded exactly once (completeness)</li>
            <li>Only eligible voters can cast votes (eligibility)</li>
            <li>No vote can be modified after casting (immutability)</li>
            <li>Vote contents remain secret (ballot secrecy)</li>
            <li>Any observer can verify the tally is correct (universal verifiability)</li>
            <li>Each voter can verify their vote was counted (individual verifiability)</li>
          </ol>
          <p>
            The architecture assumes no trusted third parties. Security relies solely on the 
            computational hardness of the Elliptic Curve Discrete Logarithm Problem (ECDLP) 
            and collision resistance of SHA3-256.
          </p>
        </div>
      </section>

      {/* Threat Model */}
      <section id="threat-model" className="wp-section">
        <h2>2. Threat Model</h2>
        <div className="wp-content">
          <h3>2.1 Adversary Capabilities</h3>
          <p>We assume a computationally bounded adversary who may:</p>
          <ul className="wp-list">
            <li>Control up to <em>f</em> of <em>3f+1</em> validator nodes (Byzantine)</li>
            <li>Observe all network traffic (passive network adversary)</li>
            <li>Corrupt election officials below the threshold <em>t</em> of <em>n</em></li>
            <li>Attempt to coerce voters after voting (coercion resistance)</li>
            <li>Collude with other adversaries (adaptive corruption)</li>
          </ul>

          <h3>2.2 Security Goals</h3>
          <div className="wp-table-wrapper">
            <table className="wp-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Definition</th>
                  <th>Mechanism</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ballot Secrecy</td>
                  <td>No coalition of size &lt; t can determine any voter's choice</td>
                  <td>Threshold ElGamal encryption</td>
                </tr>
                <tr>
                  <td>Receipt-Freeness</td>
                  <td>Voter cannot prove to coercer how they voted</td>
                  <td>Re-randomizable ciphertexts</td>
                </tr>
                <tr>
                  <td>Individual Verifiability</td>
                  <td>Voter can verify their vote is in the tally</td>
                  <td>Merkle inclusion proofs</td>
                </tr>
                <tr>
                  <td>Universal Verifiability</td>
                  <td>Anyone can verify the election result</td>
                  <td>Public ledger + ZK proofs</td>
                </tr>
                <tr>
                  <td>Eligibility</td>
                  <td>Only registered voters can vote</td>
                  <td>ZK proof of set membership</td>
                </tr>
                <tr>
                  <td>Uniqueness</td>
                  <td>Each voter votes at most once</td>
                  <td>Nullifier derivation</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>2.3 Trust Assumptions</h3>
          <p>The system requires:</p>
          <ul className="wp-list">
            <li>At least <em>2f+1</em> honest validators (for liveness)</li>
            <li>At least <em>f+1</em> honest validators (for safety)</li>
            <li>At least <em>t</em> of <em>n</em> key holders honest (for ballot secrecy)</li>
            <li>Secure client device during vote casting (endpoint security)</li>
          </ul>
        </div>
      </section>

      {/* Cryptographic Primitives */}
      <section id="primitives" className="wp-section">
        <h2>3. Cryptographic Primitives</h2>
        <div className="wp-content">
          <h3>3.1 Elliptic Curve: Curve25519</h3>
          <p>
            All asymmetric operations use Curve25519, a Montgomery curve defined over 
            𝔽<sub>p</sub> where p = 2<sup>255</sup> - 19:
          </p>
          <div className="wp-code">
            <pre>{`y² = x³ + 486662x² + x  (mod p)

Generator point G:
  x = 9
  
Group order:
  q = 2²⁵² + 27742317777372353535851937790883648493

Security level: ~128 bits (ECDLP)`}</pre>
          </div>
          <p>
            Curve25519 provides complete addition formulas (no special cases), constant-time 
            implementations, and resistance to timing attacks. The cofactor h = 8 requires 
            careful handling via clamping.
          </p>

          <h3>3.2 Digital Signatures: Ed25519</h3>
          <p>
            Signatures use EdDSA over the twisted Edwards curve birationally equivalent to 
            Curve25519:
          </p>
          <div className="wp-code">
            <pre>{`-x² + y² = 1 + dx²y²  where d = -121665/121666

Signature generation:
  1. r = H(H_prefix || sk || M)  (deterministic nonce)
  2. R = rG
  3. h = H(R || pk || M)
  4. s = r + h·sk  (mod q)
  5. σ = (R, s)

Verification:
  1. h = H(R || pk || M)
  2. Check: sG = R + h·pk`}</pre>
          </div>
          <p>
            Ed25519 signatures are 64 bytes, provide 128-bit security, and are deterministic 
            (no random nonce required), eliminating an entire class of implementation errors.
          </p>

          <h3>3.3 Hash Functions: SHA3-256 and SHA3-512</h3>
          <p>
            We use the Keccak sponge construction standardized as SHA-3:
          </p>
          <div className="wp-code">
            <pre>{`SHA3-256: 256-bit output, 128-bit collision resistance
SHA3-512: 512-bit output, 256-bit collision resistance

Sponge parameters:
  State size: 1600 bits (5×5×64 lanes)
  Rate (r): 1088 bits for SHA3-256
  Capacity (c): 512 bits for SHA3-256
  
Security properties:
  - Collision resistance: O(2^(n/2)) for n-bit output
  - Preimage resistance: O(2^n)
  - Second preimage resistance: O(2^n)`}</pre>
          </div>

          <h3>3.4 Authenticated Encryption: XSalsa20-Poly1305</h3>
          <p>
            Vote payloads are encrypted using authenticated encryption with associated data (AEAD):
          </p>
          <div className="wp-code">
            <pre>{`XSalsa20 stream cipher:
  - 256-bit key
  - 192-bit nonce (24 bytes) - safe for random generation
  - ChaCha-style quarter-round function
  
Poly1305 MAC:
  - 128-bit authenticator
  - One-time key derived from XSalsa20 output
  - Universal hash function: ((∑ cᵢrⁱ) + s) mod 2¹²⁸
  
Combined guarantees:
  - IND-CCA2 security (indistinguishable under adaptive CCA)
  - INT-CTXT (ciphertext integrity)`}</pre>
          </div>

          <h3>3.5 Key Derivation: HKDF-SHA512</h3>
          <div className="wp-code">
            <pre>{`HKDF-Extract(salt, IKM) → PRK
  PRK = HMAC-SHA512(salt, IKM)

HKDF-Expand(PRK, info, L) → OKM
  T(0) = ""
  T(i) = HMAC-SHA512(PRK, T(i-1) || info || i)
  OKM = T(1) || T(2) || ... truncated to L bytes
  
Application: Deriving vote encryption keys from ECDH shared secret`}</pre>
          </div>
        </div>
      </section>

      {/* Key Management */}
      <section id="key-management" className="wp-section">
        <h2>4. Key Management</h2>
        <div className="wp-content">
          <h3>4.1 Threshold Key Generation</h3>
          <p>
            Election decryption keys are generated using Shamir's Secret Sharing over a 
            finite field, ensuring no single party can decrypt votes:
          </p>
          <div className="wp-code">
            <pre>{`Setup: n parties, threshold t (requires t of n to decrypt)

Key Generation Protocol:
  1. Each party Pᵢ generates random polynomial fᵢ(x) of degree t-1:
     fᵢ(x) = aᵢ,₀ + aᵢ,₁x + ... + aᵢ,ₜ₋₁xᵗ⁻¹  (mod q)
     
  2. Each Pᵢ computes shares sᵢ,ⱼ = fᵢ(j) for j ∈ {1,...,n}
  
  3. Each Pᵢ sends sᵢ,ⱼ to Pⱼ (encrypted)
  
  4. Each Pⱼ computes their secret share:
     SKⱼ = Σᵢ sᵢ,ⱼ  (mod q)
     
  5. Public key: PK = Σᵢ aᵢ,₀ · G

Properties:
  - t-1 parties learn nothing about SK
  - t parties can reconstruct: SK = Σⱼ λⱼ · SKⱼ
    where λⱼ = Πₖ≠ⱼ (k/(k-j)) (Lagrange coefficients)`}</pre>
          </div>

          <h3>4.2 Key Hierarchy</h3>
          <div className="wp-diagram">
            <pre>{`
┌─────────────────────────────────────────────────────────────┐
│                    ROOT OF TRUST                            │
│              Hardware Security Module (HSM)                  │
│                  FIPS 140-2 Level 3                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ Org Key  │   │ Org Key  │   │ Org Key  │
    │ (Tenant) │   │ (Tenant) │   │ (Tenant) │
    └────┬─────┘   └────┬─────┘   └────┬─────┘
         │              │              │
    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
    ▼         ▼    ▼         ▼    ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Election│ │Election│ │Election│ │Election│
│  Key   │ │  Key   │ │  Key   │ │  Key   │
└───┬────┘ └────────┘ └────────┘ └────────┘
    │
    ├──────────────────┐
    ▼                  ▼
┌─────────┐      ┌─────────┐
│ Share 1 │ ...  │ Share n │  (Shamir t-of-n)
└─────────┘      └─────────┘
            `}</pre>
          </div>

          <h3>4.3 Key Rotation</h3>
          <p>
            Keys are rotated using proactive secret sharing to limit exposure from 
            potential compromises:
          </p>
          <div className="wp-code">
            <pre>{`Rotation Protocol (periodic refresh):
  1. Each party Pᵢ generates random polynomial δᵢ(x) with δᵢ(0) = 0
  
  2. Parties exchange δᵢ(j) values
  
  3. New share: SK'ⱼ = SKⱼ + Σᵢ δᵢ(j)
  
Properties:
  - Public key PK remains unchanged
  - Old shares become useless after rotation
  - Adversary must corrupt t parties in same epoch`}</pre>
          </div>
        </div>
      </section>

      {/* Vote Encryption */}
      <section id="vote-encryption" className="wp-section">
        <h2>5. Vote Encryption Protocol</h2>
        <div className="wp-content">
          <h3>5.1 Encryption Scheme</h3>
          <p>
            Votes are encrypted using a hybrid scheme combining ECDH key agreement 
            with symmetric AEAD:
          </p>
          <div className="wp-code">
            <pre>{`Vote Encryption:

Input: vote v, election public key PK_election
Output: ciphertext C, ephemeral public key E

1. Generate ephemeral keypair:
   e ←$ ℤq  (random scalar)
   E = e · G  (ephemeral public key)

2. Compute shared secret:
   S = e · PK_election  (ECDH)

3. Derive encryption key:
   K = HKDF-SHA512(S, "vote-encryption", 32)

4. Generate random nonce:
   N ←$ {0,1}^192  (24 bytes)

5. Encrypt vote:
   C = XSalsa20-Poly1305.Encrypt(K, N, v)

6. Output: (E, N, C)


Vote Decryption (threshold):

Input: (E, N, C), threshold shares {SK₁, ..., SKₜ}

1. Each party Pᵢ computes partial decryption:
   Dᵢ = SKᵢ · E

2. Combine using Lagrange interpolation:
   S = Σᵢ λᵢ · Dᵢ  (reconstructs e · SK · G = e · PK)

3. Derive decryption key:
   K = HKDF-SHA512(S, "vote-encryption", 32)

4. Decrypt:
   v = XSalsa20-Poly1305.Decrypt(K, N, C)`}</pre>
          </div>

          <h3>5.2 Vote Format</h3>
          <div className="wp-code">
            <pre>{`VotePayload = {
  election_id:    bytes32,      // SHA3-256 of election parameters
  candidate_id:   bytes32,      // Identifier of selected candidate
  timestamp:      uint64,       // Unix timestamp (milliseconds)
  voter_nullifier: bytes32,     // Derived from voter secret (prevents double-voting)
  randomness:     bytes32       // For re-randomization
}

Total plaintext size: 160 bytes
Ciphertext overhead: +16 bytes (Poly1305 tag) + 24 bytes (nonce) + 32 bytes (ephemeral key)
Total encrypted size: 232 bytes`}</pre>
          </div>

          <h3>5.3 Homomorphic Tallying (Optional)</h3>
          <p>
            For elections requiring tallying without full decryption, we support 
            additive homomorphic encryption using exponential ElGamal:
          </p>
          <div className="wp-code">
            <pre>{`Exponential ElGamal:

Encryption of vote v ∈ {0, 1}:
  (C₁, C₂) = (r·G, r·PK + v·G)

Homomorphic addition:
  (C₁, C₂) + (C'₁, C'₂) = (C₁ + C'₁, C₂ + C'₂)
  
  This encrypts: v + v' (mod q)

Decryption:
  v·G = C₂ - SK·C₁
  
  Recover v via discrete log (efficient for small v using baby-step giant-step)

Limitation: Efficient only when total vote count < 2²⁰`}</pre>
          </div>
        </div>
      </section>

      {/* Zero-Knowledge Proofs */}
      <section id="zero-knowledge" className="wp-section">
        <h2>6. Zero-Knowledge Proofs</h2>
        <div className="wp-content">
          <h3>6.1 Proof of Eligibility</h3>
          <p>
            Voters prove they are in the set of registered voters without revealing 
            their identity using a ZK set membership proof:
          </p>
          <div className="wp-code">
            <pre>{`Eligibility Proof (Merkle-based):

Public inputs:
  - Merkle root R of registered voter set
  - Nullifier N (publicly revealed, unique per voter per election)

Private inputs:
  - Voter secret key sk
  - Merkle path P proving leaf in tree
  - Leaf index i

Circuit constraints:
  1. N = H(sk || election_id)  // Nullifier derivation
  2. pk = sk · G               // Public key derivation
  3. leaf = H(pk)              // Leaf value
  4. MerkleVerify(R, leaf, P, i) = true  // Path verification

Proof system: Groth16 (succinct, ~200 bytes proof)
Verification time: ~10ms (3 pairings on BN254)`}</pre>
          </div>

          <h3>6.2 Proof of Valid Vote</h3>
          <p>
            Each vote includes a proof that the encrypted value is a valid selection:
          </p>
          <div className="wp-code">
            <pre>{`Vote Validity Proof (1-of-n):

For single-choice election with candidates {c₁, ..., cₙ}:

Public inputs:
  - Encrypted vote (E, C)
  - Election public key PK

Private inputs:
  - Vote plaintext v
  - Encryption randomness r

Circuit constraints:
  1. v ∈ {c₁, ..., cₙ}  // Vote is valid candidate
  2. E = r · G           // Ephemeral key correct
  3. C = Enc(PK, v, r)   // Encryption correct

For ranked-choice:
  - Additional constraint: all ranks distinct
  - v = (v₁, v₂, ..., vₖ) where vᵢ ∈ candidates, all unique`}</pre>
          </div>

          <h3>6.3 Proof of Correct Decryption</h3>
          <div className="wp-code">
            <pre>{`Decryption Proof (Chaum-Pedersen):

Prover (decryption authority) shows:
  D = SK · E  (partial decryption is correct)

Without revealing SK, prove:
  log_G(PK) = log_E(D)

Protocol:
  1. Prover: r ←$ ℤq, A = r·G, B = r·E
  2. Challenge: c = H(G, PK, E, D, A, B)
  3. Response: s = r + c·SK  (mod q)
  4. Verifier checks:
     - s·G = A + c·PK
     - s·E = B + c·D

This is a Σ-protocol made non-interactive via Fiat-Shamir.`}</pre>
          </div>

          <h3>6.4 Circuit Complexity</h3>
          <div className="wp-table-wrapper">
            <table className="wp-table">
              <thead>
                <tr>
                  <th>Proof Type</th>
                  <th>R1CS Constraints</th>
                  <th>Proof Size</th>
                  <th>Proving Time</th>
                  <th>Verify Time</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Eligibility (depth 20)</td>
                  <td>~50,000</td>
                  <td>192 bytes</td>
                  <td>~2s</td>
                  <td>~10ms</td>
                </tr>
                <tr>
                  <td>Vote validity (10 candidates)</td>
                  <td>~10,000</td>
                  <td>192 bytes</td>
                  <td>~500ms</td>
                  <td>~10ms</td>
                </tr>
                <tr>
                  <td>Correct decryption</td>
                  <td>N/A (Σ-protocol)</td>
                  <td>64 bytes</td>
                  <td>~1ms</td>
                  <td>~1ms</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Merkle Trees */}
      <section id="merkle" className="wp-section">
        <h2>7. Merkle Tree Construction</h2>
        <div className="wp-content">
          <h3>7.1 Tree Structure</h3>
          <p>
            Votes are committed to a sparse Merkle tree enabling efficient inclusion 
            proofs with O(log n) complexity:
          </p>
          <div className="wp-diagram">
            <pre>{`
                        Root Hash
                    ┌───────┴───────┐
                H(A||B)           H(C||D)
               ┌───┴───┐         ┌───┴───┐
              H(E||F) H(G||H)   H(I||J) H(K||L)
              ┌─┴─┐   ┌─┴─┐     ┌─┴─┐   ┌─┴─┐
              E   F   G   H     I   J   K   L
              │   │   │   │     │   │   │   │
              v₁  v₂  v₃  v₄    v₅  v₆  v₇  v₈

Tree depth: ⌈log₂(max_votes)⌉
For 10M votes: depth = 24
Proof size: 24 × 32 bytes = 768 bytes`}</pre>
          </div>

          <h3>7.2 Incremental Updates</h3>
          <div className="wp-code">
            <pre>{`Insert vote at index i:

1. Compute leaf hash:
   leaf = SHA3-256(vote_receipt_hash || timestamp)

2. Update path from leaf to root:
   For level l from 0 to depth-1:
     bit = (i >> l) & 1
     if bit == 0:
       node[l+1] = H(new_node || sibling[l])
     else:
       node[l+1] = H(sibling[l] || new_node)

3. New root = node[depth]

Time complexity: O(log n)
Space complexity: O(log n) for proof storage`}</pre>
          </div>

          <h3>7.3 Inclusion Proof</h3>
          <div className="wp-code">
            <pre>{`GenerateProof(tree, index):
  proof = []
  current_index = index
  
  for level in 0..depth:
    sibling_index = current_index ^ 1  // Flip last bit
    proof.append({
      hash: tree[level][sibling_index],
      position: "left" if sibling_index < current_index else "right"
    })
    current_index = current_index >> 1
  
  return proof


VerifyProof(root, leaf, proof, index):
  computed = leaf
  current_index = index
  
  for sibling in proof:
    if sibling.position == "left":
      computed = H(sibling.hash || computed)
    else:
      computed = H(computed || sibling.hash)
    current_index = current_index >> 1
  
  return computed == root`}</pre>
          </div>

          <h3>7.4 Security Properties</h3>
          <ul className="wp-list">
            <li>
              <strong>Binding:</strong> Given collision-resistant H, finding two different 
              leaves that produce the same root requires O(2<sup>128</sup>) work
            </li>
            <li>
              <strong>Hiding:</strong> Root reveals nothing about individual leaves 
              (one-way function)
            </li>
            <li>
              <strong>Efficient verification:</strong> Proof verification requires only 
              O(log n) hash computations
            </li>
          </ul>
        </div>
      </section>

      {/* DAG Structure */}
      <section id="dag" className="wp-section">
        <h2>8. Directed Acyclic Graph Structure</h2>
        <div className="wp-content">
          <h3>8.1 Graph-Based Vote Ordering</h3>
          <p>
            Rather than a simple linear chain, votes form a directed acyclic graph (DAG) 
            where each new vote references multiple previous votes. This provides:
          </p>
          <ul className="wp-list">
            <li>Higher throughput via parallel vote processing</li>
            <li>Reduced confirmation latency</li>
            <li>Natural resistance to ordering manipulation</li>
            <li>Efficient conflict detection</li>
          </ul>

          <div className="wp-diagram">
            <pre>{`
         ┌─────┐     ┌─────┐     ┌─────┐
         │ v₁  │     │ v₂  │     │ v₃  │    (Genesis votes)
         └──┬──┘     └──┬──┘     └──┬──┘
            │    ╲      │      ╱    │
            │     ╲     │     ╱     │
            ▼      ╲    ▼    ╱      ▼
         ┌─────┐    ╲┌─────┐╱    ┌─────┐
         │ v₄  │─────│ v₅  │─────│ v₆  │
         └──┬──┘     └──┬──┘     └──┬──┘
            │      ╱    │    ╲      │
            │     ╱     │     ╲     │
            ▼    ╱      ▼      ╲    ▼
         ┌─────┐     ┌─────┐     ┌─────┐
         │ v₇  │─────│ v₈  │─────│ v₉  │
         └─────┘     └─────┘     └─────┘

Each vote references 2-3 parent votes (configurable width).
Total ordering derived via topological sort.`}</pre>
          </div>

          <h3>8.2 Vote Structure with DAG References</h3>
          <div className="wp-code">
            <pre>{`VoteNode = {
  id:             bytes32,     // SHA3-256(vote_data)
  parents:        bytes32[],   // References to 2-3 parent votes
  height:         uint64,      // Max parent height + 1
  cumulative_weight: uint64,   // Sum of ancestor weights
  
  // Vote data
  encrypted_vote: bytes,
  nullifier:      bytes32,
  eligibility_proof: bytes,
  validity_proof:   bytes,
  
  // Signatures
  voter_signature:    bytes64,  // Ed25519 over vote data
  validator_signatures: bytes[], // BFT attestations
  
  // Timestamps
  client_timestamp:   uint64,
  validator_timestamp: uint64
}`}</pre>
          </div>

          <h3>8.3 Topological Ordering</h3>
          <p>
            Final vote order is determined by a deterministic topological sort:
          </p>
          <div className="wp-code">
            <pre>{`TotalOrder(dag):
  // Kahn's algorithm with deterministic tie-breaking
  
  in_degree = {v: len(v.parents) for v in dag}
  queue = PriorityQueue()  // Min-heap by (height, hash)
  
  for v in dag:
    if in_degree[v] == 0:
      queue.push((v.height, v.id), v)
  
  order = []
  while not queue.empty():
    v = queue.pop()
    order.append(v)
    
    for child in v.children:
      in_degree[child] -= 1
      if in_degree[child] == 0:
        queue.push((child.height, child.id), child)
  
  return order

Tie-breaking: Lower hash wins (deterministic across all nodes)`}</pre>
          </div>

          <h3>8.4 Conflict Resolution</h3>
          <p>
            Double-vote attempts are detected and rejected:
          </p>
          <div className="wp-code">
            <pre>{`DetectDoubleVote(new_vote, dag):
  nullifier = new_vote.nullifier
  
  // Check nullifier uniqueness in DAG
  for v in dag.ancestors(new_vote):
    if v.nullifier == nullifier:
      return REJECT("Double vote detected")
  
  // Check in confirmed set
  if nullifier in confirmed_nullifiers:
    return REJECT("Double vote detected")
  
  return ACCEPT


// The nullifier is derived deterministically:
nullifier = SHA3-256(voter_secret || election_id)

// Same voter + same election = same nullifier
// Different election = different nullifier (can vote in multiple elections)`}</pre>
          </div>
        </div>
      </section>

      {/* Consensus */}
      <section id="consensus" className="wp-section">
        <h2>9. Byzantine Fault Tolerant Consensus</h2>
        <div className="wp-content">
          <h3>9.1 Consensus Overview</h3>
          <p>
            Validators reach agreement on vote ordering using a practical BFT protocol 
            derived from PBFT with optimizations for our DAG structure:
          </p>
          <div className="wp-code">
            <pre>{`Parameters:
  n = total validators
  f = maximum Byzantine validators (n ≥ 3f + 1)
  
Safety: If two honest validators finalize different votes at same position,
        at least f+1 validators are Byzantine (contradiction if f+1 honest)

Liveness: Progress guaranteed if at least 2f+1 validators are online and honest`}</pre>
          </div>

          <h3>9.2 Consensus Phases</h3>
          <div className="wp-code">
            <pre>{`Phase 1: PROPOSE
  - Leader broadcasts new vote batch B with sequence number s
  - Message: ⟨PROPOSE, s, B, H(B)⟩_σ_leader

Phase 2: PREPARE  
  - Validators verify batch validity
  - Broadcast: ⟨PREPARE, s, H(B)⟩_σ_validator
  - Wait for 2f+1 matching PREPARE messages (prepare certificate)

Phase 3: COMMIT
  - Upon prepare certificate, broadcast: ⟨COMMIT, s, H(B)⟩_σ_validator
  - Wait for 2f+1 matching COMMIT messages (commit certificate)

Phase 4: FINALIZE
  - Upon commit certificate, batch B is finalized
  - Update Merkle root, broadcast to clients
  - Store commit certificate as proof of finality`}</pre>
          </div>

          <h3>9.3 View Change Protocol</h3>
          <div className="wp-code">
            <pre>{`// Triggered when leader fails or is Byzantine

ViewChange(new_view):
  1. Validator stops accepting messages for old view
  
  2. Broadcast: ⟨VIEW-CHANGE, new_view, prepared_certificates⟩_σ
  
  3. New leader collects 2f+1 VIEW-CHANGE messages
  
  4. New leader computes safe starting state:
     - For each sequence s, select batch with highest prepare certificate
     - If no certificate, slot is empty
  
  5. New leader broadcasts:
     ⟨NEW-VIEW, new_view, view_change_proofs, new_proposals⟩_σ
  
  6. Validators verify NEW-VIEW and resume protocol`}</pre>
          </div>

          <h3>9.4 Performance Characteristics</h3>
          <div className="wp-table-wrapper">
            <table className="wp-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Message complexity</td>
                  <td>O(n²)</td>
                  <td>Per batch</td>
                </tr>
                <tr>
                  <td>Latency (normal)</td>
                  <td>3 rounds</td>
                  <td>~100-300ms typical</td>
                </tr>
                <tr>
                  <td>Latency (view change)</td>
                  <td>4 rounds</td>
                  <td>~500ms typical</td>
                </tr>
                <tr>
                  <td>Throughput</td>
                  <td>10,000+ votes/sec</td>
                  <td>Batching 1000 votes</td>
                </tr>
                <tr>
                  <td>Finality</td>
                  <td>Immediate</td>
                  <td>No probabilistic confirmation</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Verification */}
      <section id="verification" className="wp-section">
        <h2>10. Universal Verification</h2>
        <div className="wp-content">
          <h3>10.1 Verification Levels</h3>
          <div className="wp-table-wrapper">
            <table className="wp-table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Who</th>
                  <th>What They Verify</th>
                  <th>How</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Individual</td>
                  <td>Voter</td>
                  <td>Their vote was included</td>
                  <td>Merkle proof + receipt</td>
                </tr>
                <tr>
                  <td>Eligibility</td>
                  <td>Anyone</td>
                  <td>Only registered voters voted</td>
                  <td>ZK eligibility proofs</td>
                </tr>
                <tr>
                  <td>Uniqueness</td>
                  <td>Anyone</td>
                  <td>No double votes</td>
                  <td>Nullifier uniqueness</td>
                </tr>
                <tr>
                  <td>Validity</td>
                  <td>Anyone</td>
                  <td>Votes are valid selections</td>
                  <td>ZK validity proofs</td>
                </tr>
                <tr>
                  <td>Tally</td>
                  <td>Anyone</td>
                  <td>Decryption is correct</td>
                  <td>Decryption proofs</td>
                </tr>
                <tr>
                  <td>Integrity</td>
                  <td>Anyone</td>
                  <td>Chain is unmodified</td>
                  <td>Hash chain + Ethereum anchor</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>10.2 Public Bulletin Board</h3>
          <div className="wp-code">
            <pre>{`All verification data is published to an append-only public bulletin board:

BulletinBoard = [
  // Per vote
  {
    vote_id: bytes32,
    encrypted_vote: bytes,
    eligibility_proof: bytes,
    validity_proof: bytes,
    nullifier: bytes32,
    merkle_root_at_insert: bytes32,
    timestamp: uint64
  },
  
  // Per block
  {
    block_id: bytes32,
    merkle_root: bytes32,
    previous_block: bytes32,
    validator_signatures: bytes[],
    ethereum_anchor_tx: bytes32
  },
  
  // At tally
  {
    election_id: bytes32,
    encrypted_tallies: bytes[],
    decryption_shares: bytes[],
    decryption_proofs: bytes[],
    final_result: uint64[]
  }
]

Anyone can download and verify the entire election.`}</pre>
          </div>

          <h3>10.3 External Anchoring</h3>
          <p>
            Periodic Merkle roots are anchored to Ethereum mainnet for external verification:
          </p>
          <div className="wp-code">
            <pre>{`Ethereum Anchor Contract:

contract VoteAnchor {
  mapping(bytes32 => uint256) public anchors;  // merkleRoot => block.timestamp
  
  event Anchored(
    bytes32 indexed electionId,
    bytes32 merkleRoot,
    uint256 voteCount,
    uint256 timestamp
  );
  
  function anchor(
    bytes32 electionId,
    bytes32 merkleRoot,
    uint256 voteCount,
    bytes[] calldata validatorSignatures
  ) external {
    require(validatorSignatures.length >= 2*f+1, "Insufficient signatures");
    require(verifySignatures(merkleRoot, validatorSignatures), "Invalid signatures");
    
    anchors[merkleRoot] = block.timestamp;
    emit Anchored(electionId, merkleRoot, voteCount, block.timestamp);
  }
}

Anchoring frequency: Every 1000 votes or 10 minutes, whichever comes first`}</pre>
          </div>
        </div>
      </section>

      {/* Formal Security */}
      <section id="formal" className="wp-section">
        <h2>11. Formal Security Analysis</h2>
        <div className="wp-content">
          <h3>11.1 Security Reductions</h3>
          <div className="wp-code">
            <pre>{`Theorem 1 (Ballot Secrecy):
  If the ECDLP is hard on Curve25519 and the threshold t-of-n sharing is secure,
  then no coalition of fewer than t parties can determine any voter's choice
  with advantage greater than 2^(-128).

Proof sketch:
  - Reduction to DDH: Distinguishing encrypted votes reduces to DDH on Curve25519
  - DDH → ECDLP: DDH assumption holds if ECDLP is hard
  - Threshold: Shamir sharing is information-theoretically secure for t-1 parties


Theorem 2 (Soundness of ZK Proofs):
  If SHA3-256 is collision-resistant and the Groth16 proof system is sound,
  then no PPT adversary can create a valid eligibility proof without being
  in the registered voter set, except with negligible probability.

Proof sketch:
  - Groth16 soundness: Computational soundness under q-SDH assumption
  - Merkle binding: Collision resistance of SHA3-256
  - Composition: Sequential composition of secure protocols


Theorem 3 (Immutability):
  Any modification to a confirmed vote requires either:
  (a) Finding a SHA3-256 collision (complexity 2^128), or
  (b) Corrupting f+1 validators (contradicts assumption)

Proof:
  - Hash chain: Each block commits to previous via SHA3-256
  - BFT finality: Confirmed blocks have 2f+1 signatures
  - Ethereum anchor: External timestamp prevents retroactive changes`}</pre>
          </div>

          <h3>11.2 Attack Analysis</h3>
          <div className="wp-table-wrapper">
            <table className="wp-table">
              <thead>
                <tr>
                  <th>Attack Vector</th>
                  <th>Mitigation</th>
                  <th>Residual Risk</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Vote manipulation</td>
                  <td>Encrypted votes, ZK validity proofs</td>
                  <td>Negligible (2<sup>-128</sup>)</td>
                </tr>
                <tr>
                  <td>Double voting</td>
                  <td>Deterministic nullifiers</td>
                  <td>None (information-theoretic)</td>
                </tr>
                <tr>
                  <td>Ballot stuffing</td>
                  <td>ZK eligibility proofs</td>
                  <td>Negligible</td>
                </tr>
                <tr>
                  <td>Vote deletion</td>
                  <td>Merkle proofs, receipts</td>
                  <td>Detectable by voter</td>
                </tr>
                <tr>
                  <td>Coercion</td>
                  <td>Receipt-freeness, re-voting</td>
                  <td>Limited (requires re-vote)</td>
                </tr>
                <tr>
                  <td>Timing attacks</td>
                  <td>Constant-time crypto, mixing</td>
                  <td>Minimal</td>
                </tr>
                <tr>
                  <td>Key compromise</td>
                  <td>Threshold, HSM, rotation</td>
                  <td>Requires t of n corrupt</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>11.3 Compliance Standards</h3>
          <ul className="wp-list">
            <li><strong>FIPS 140-2 Level 3:</strong> HSM key storage</li>
            <li><strong>Common Criteria EAL4+:</strong> Security evaluation</li>
            <li><strong>NIST SP 800-57:</strong> Key management</li>
            <li><strong>EAC VVSG 2.0:</strong> Voting system guidelines</li>
            <li><strong>GDPR Article 25:</strong> Privacy by design</li>
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="wp-footer">
        <p>
          This document is provided for technical review and security audit purposes.
          Implementation details may vary. Contact security team for clarifications.
        </p>
        <p className="wp-version">
          Document version: 2.1.0 | SHA3-256: [computed at build]
        </p>
      </footer>
    </div>
  );
}
