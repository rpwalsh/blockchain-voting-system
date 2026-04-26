/**
 * Crypto Demo Page - Completely Transparent UX
 * NO hiding, NO automated animations, EVERYTHING visible and clickable
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import './CryptoDemo.css';

interface Step {
  id: string;
  title: string;
  description: string;
  input: string;
  output: string;
  algorithm: string;
  duration: string;
  icon: string;
}

export default function CryptoDemo() {
  const [selectedFlow, setSelectedFlow] = useState<'encryption' | 'verification' | 'merkle'>('encryption');

  const encryptionSteps: Step[] = [
    {
      id: 'enc-1',
      title: 'Step 1: Key Pair Generation',
      description: 'Generate ephemeral Curve25519 ECDH key pair for this voting session. Private key retained client-side only.',
      input: 'Random entropy (256 bits from CSPRNG)',
      output: 'Public Key: 32 bytes\nPrivate Key: 32 bytes (local storage)',
      algorithm: 'Curve25519 ECDH',
      duration: '~0.5ms',
      icon: '[K]'
    },
    {
      id: 'enc-2',
      title: 'Step 2: Shared Secret Derivation',
      description: 'Elliptic curve Diffie-Hellman key exchange with election authority public key.',
      input: 'Client private key (32 bytes)\nElection public key (32 bytes)',
      output: 'Shared secret: 32 bytes\n(Symmetric encryption key)',
      algorithm: 'X25519 Key Exchange',
      duration: '~0.3ms',
      icon: '[X]'
    },
    {
      id: 'enc-3',
      title: 'Step 3: Vote Encryption',
      description: 'Authenticated encryption with associated data. Provides confidentiality and integrity.',
      input: 'Vote plaintext\nShared secret (32 bytes)\nRandom nonce (24 bytes)',
      output: 'Ciphertext\nPoly1305 MAC (16 bytes)\nNonce (24 bytes)',
      algorithm: 'XSalsa20-Poly1305 AEAD',
      duration: '~0.4ms',
      icon: '[E]'
    },
    {
      id: 'enc-4',
      title: 'Step 4: Receipt Generation',
      description: 'Cryptographic hash of vote package for verification protocol.',
      input: 'Ciphertext\nTimestamp\nNonce\nPublic key',
      output: 'SHA3-256 digest: 64 hex characters',
      algorithm: 'SHA3-256',
      duration: '~0.2ms',
      icon: '[H]'
    },
    {
      id: 'enc-5',
      title: 'Step 5: Digital Signature',
      description: 'Edwards-curve Digital Signature Algorithm for non-repudiation.',
      input: 'Receipt hash\nVote metadata\nAuthority private key',
      output: 'Ed25519 signature: 64 bytes',
      algorithm: 'Ed25519 Signatures',
      duration: '~0.3ms',
      icon: '[S]'
    },
    {
      id: 'enc-6',
      title: 'Step 6: Ledger Entry',
      description: 'Append-only ledger write with cryptographic hash chain linkage.',
      input: 'Ciphertext\nSignature\nTimestamp\nReceipt hash',
      output: 'Ledger entry hash\nBlock index',
      algorithm: 'SHA3-512',
      duration: '~0.2ms',
      icon: '[L]'
    }
  ];

  const verificationSteps: Step[] = [
    {
      id: 'ver-1',
      title: 'Step 1: Receipt Lookup',
      description: 'Query distributed ledger via receipt hash index.',
      input: 'Receipt hash: a7f3c9d2...',
      output: 'Ledger entry:\nCiphertext\nSignature\nTimestamp',
      algorithm: 'B-tree index lookup',
      duration: '~2ms',
      icon: '[Q]'
    },
    {
      id: 'ver-2',
      title: 'Step 2: Signature Verification',
      description: 'Ed25519 signature verification against authority public key.',
      input: 'Signature (64 bytes)\nPublic key (32 bytes)\nMessage digest',
      output: 'Verification result: VALID',
      algorithm: 'Ed25519 Verify',
      duration: '~0.5ms',
      icon: '[V]'
    },
    {
      id: 'ver-3',
      title: 'Step 3: Merkle Proof Construction',
      description: 'Generate minimal proof path from leaf to root. Complexity: O(log n).',
      input: 'Vote index: #543\nTree size: 10,000',
      output: 'Proof: 14 sibling hashes\n(log₂ 10,000 ≈ 14)',
      algorithm: 'Binary tree path',
      duration: '~0.3ms',
      icon: '[M]'
    },
    {
      id: 'ver-4',
      title: 'Step 4: Merkle Proof Verification',
      description: 'Iteratively hash leaf with siblings to recompute root.',
      input: 'Leaf hash\n14 sibling hashes\nExpected root',
      output: 'Computed root: 9f3e...\nExpected root: 9f3e...\nResult: MATCH',
      algorithm: 'Iterative hash chain',
      duration: '~0.2ms',
      icon: '[C]'
    },
    {
      id: 'ver-5',
      title: 'Step 5: Timestamp Validation',
      description: 'Verify temporal bounds of transaction.',
      input: 'Vote timestamp: 1699200622\nElection window: [1699174800, 1699225200]',
      output: 'Result: WITHIN_BOUNDS',
      algorithm: 'Integer comparison',
      duration: '~0.1ms',
      icon: '[T]'
    },
    {
      id: 'ver-6',
      title: 'Step 6: Blockchain Anchor Verification',
      description: 'Query Ethereum smart contract for immutable root hash commitment.',
      input: 'Merkle root: 9f3e...\nContract address: 0x42a7...',
      output: 'Block: 18,234,567\nConfirmed: TRUE',
      algorithm: 'Web3 RPC call',
      duration: '~100ms',
      icon: '[B]'
    }
  ];

  const merkleSteps: Step[] = [
    {
      id: 'mrk-1',
      title: 'Step 1: Leaf Hash Computation',
      description: 'Hash encrypted vote to create Merkle tree leaf node.',
      input: 'Ciphertext: 0x4f3a2b1c...',
      output: 'Leaf hash: 7a9e2f1d3c8b...',
      algorithm: 'SHA3-256',
      duration: '~0.1ms',
      icon: '[H]'
    },
    {
      id: 'mrk-2',
      title: 'Step 2: Sibling Hash Retrieval',
      description: 'Query server for minimal proof set. Public data, no authentication required.',
      input: 'Vote index: #543\nTree height: 14',
      output: 'Siblings: [3e7f..., a2d9..., ...]',
      algorithm: 'Tree traversal',
      duration: '~0.2ms',
      icon: '[R]'
    },
    {
      id: 'mrk-3',
      title: 'Step 3: Level 1 Hash',
      description: 'Concatenate and hash leaf with sibling.',
      input: 'Left: 7a9e...\nRight: 3e7f...',
      output: 'Parent: 9b2c1f...',
      algorithm: 'SHA3-256(L || R)',
      duration: '~0.1ms',
      icon: '[1]'
    },
    {
      id: 'mrk-4',
      title: 'Step 4: Level 2 Hash',
      description: 'Continue iterative hash up tree hierarchy.',
      input: 'Node: 9b2c...\nSibling: a2d9...',
      output: 'Parent: 5f8e3a...',
      algorithm: 'SHA3-256(L || R)',
      duration: '~0.1ms',
      icon: '[2]'
    },
    {
      id: 'mrk-5',
      title: 'Step 5: Root Computation',
      description: 'Final hash operation yields Merkle root.',
      input: 'Penultimate node\nFinal sibling',
      output: 'Merkle root: 9f3e7d2a...',
      algorithm: 'SHA3-256(L || R)',
      duration: '~0.1ms',
      icon: '[R]'
    },
    {
      id: 'mrk-6',
      title: 'Step 6: Root Comparison',
      description: 'Constant-time equality check of computed vs published root.',
      input: 'Computed: 9f3e7d2a...\nPublished: 9f3e7d2a...',
      output: 'Result: EQUAL\nProof: VALID',
      algorithm: 'Constant-time memcmp',
      duration: '~0.1ms',
      icon: '[=]'
    }
  ];

  const getSteps = () => {
    switch (selectedFlow) {
      case 'encryption': return encryptionSteps;
      case 'verification': return verificationSteps;
      case 'merkle': return merkleSteps;
    }
  };

  const { darkMode } = useTheme();

  return (
    <div className={`page-container ${darkMode ? 'dark-mode' : ''}`}>
      <div className="page-header">
        <h1>Cryptographic Architecture</h1>
        <p className="page-subtitle">
          Custom blockchain implementation with zero-trust verification
        </p>
        <Link to="/" className="btn btn-secondary">← Back</Link>
      </div>

      {/* BLOCKCHAIN IMPLEMENTATION - HERO SECTION */}
      <section className="blockchain-hero">
        <h2>Custom Blockchain Implementation</h2>
        <div className="blockchain-overview">
          <div className="blockchain-property">
            <h3>Consensus Algorithm</h3>
            <p>Byzantine Fault Tolerant (BFT) with 2f+1 node agreement requirement</p>
          </div>
          <div className="blockchain-property">
            <h3>Block Structure</h3>
            <p>SHA3-256 linked blocks with Merkle root verification</p>
          </div>
          <div className="blockchain-property">
            <h3>Network Topology</h3>
            <p>Distributed ledger across N independent verification nodes</p>
          </div>
          <div className="blockchain-property">
            <h3>Finality</h3>
            <p>Deterministic finality - no probabilistic confirmation delays</p>
          </div>
        </div>

        <div className="blockchain-technical">
          <h3>Block Schema</h3>
          <pre className="code-block">{`interface Block {
  index: number;              // Sequential block number
  timestamp: number;          // Unix timestamp (milliseconds)
  transactions: Transaction[]; // Batch of verified votes
  merkleRoot: string;         // SHA3-256 root of transaction tree
  previousHash: string;       // SHA3-256 of previous block
  hash: string;               // SHA3-256 of current block
  nonce: number;              // BFT consensus proof
  validator: string;          // Ed25519 public key of validator
  signature: string;          // Ed25519 signature of block
}`}</pre>

          <h3>Transaction Schema</h3>
          <pre className="code-block">{`interface Transaction {
  id: string;                 // UUID v4
  voterId: string;            // Anonymized voter identifier
  electionId: string;         // Election UUID
  encryptedVote: string;      // XSalsa20-Poly1305 ciphertext
  signature: string;          // Ed25519 signature
  timestamp: number;          // Unix timestamp
  merkleProof: string[];      // Path to Merkle root
}`}</pre>

          <h3>Cryptographic Guarantees</h3>
          <ul className="guarantees-list">
            <li>Immutability: Any tampering breaks SHA3-256 chain linkage</li>
            <li>Auditability: Complete history from genesis block verifiable in O(n)</li>
            <li>Non-repudiation: Ed25519 signatures prevent vote denial</li>
            <li>Privacy: XSalsa20-Poly1305 AEAD ensures vote confidentiality</li>
            <li>Integrity: Merkle proofs enable O(log n) inclusion verification</li>
          </ul>
        </div>
      </section>

      <div className="flow-selector">
        <h2>Cryptographic Primitives</h2>
        <div className="flow-buttons">
          <button
            className={`flow-btn ${selectedFlow === 'encryption' ? 'selected' : ''}`}
            onClick={() => setSelectedFlow('encryption')}
          >
            <span className="flow-icon">[ENC]</span>
            <div className="flow-info">
              <h3>Curve25519 + XSalsa20-Poly1305</h3>
              <p>ECDH key exchange with authenticated encryption (AEAD)</p>
              <span className="flow-meta">6 steps • ~2ms • 256-bit security</span>
            </div>
          </button>

          <button
            className={`flow-btn ${selectedFlow === 'verification' ? 'selected' : ''}`}
            onClick={() => setSelectedFlow('verification')}
          >
            <span className="flow-icon">[VRF]</span>
            <div className="flow-info">
              <h3>Ed25519 Digital Signatures</h3>
              <p>SHA3-512 + EdDSA signature verification</p>
              <span className="flow-meta">6 steps • ~104ms • 128-bit security</span>
            </div>
          </button>

          <button
            className={`flow-btn ${selectedFlow === 'merkle' ? 'selected' : ''}`}
            onClick={() => setSelectedFlow('merkle')}
          >
            <span className="flow-icon">[MRK]</span>
            <div className="flow-info">
              <h3>SHA3-256 Merkle Tree</h3>
              <p>Binary hash tree with O(log n) inclusion proofs</p>
              <span className="flow-meta">6 steps • ~0.7ms • collision resistant</span>
            </div>
          </button>
        </div>
      </div>

      <div className="steps-container">
        <h2 className="steps-title">
          {selectedFlow === 'encryption' && 'Vote Encryption Protocol'}
          {selectedFlow === 'verification' && 'Signature Verification Protocol'}
          {selectedFlow === 'merkle' && 'Merkle Tree Construction'}
        </h2>
        <p className="steps-subtitle">Complete technical implementation with input → algorithm → output</p>

        <div className="steps-list">
          {getSteps().map((step, index) => (
            <div
              key={step.id}
              className="step-card expanded"
            >
              <div className="step-card-header">
                <div className="step-left">
                  <span className="step-icon-large">{step.icon}</span>
                  <div className="step-title-block">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </div>
                <div className="step-right">
                  <span className="step-duration">{step.duration}</span>
                </div>
              </div>

              <div className="step-card-details">
                <div className="detail-section">
                  <h4>[IN] Input</h4>
                  <pre className="detail-code">{step.input}</pre>
                </div>

                <div className="detail-arrow-large">→</div>

                <div className="detail-section">
                  <h4>[ALG] Algorithm</h4>
                  <code className="detail-algorithm">{step.algorithm}</code>
                </div>

                <div className="detail-arrow-large">→</div>

                <div className="detail-section">
                  <h4>[OUT] Output</h4>
                  <pre className="detail-code">{step.output}</pre>
                </div>
              </div>

              {index < getSteps().length - 1 && <div className="step-connector"></div>}
            </div>
          ))}
        </div>
      </div>

      <div className="info-grid">
        <div className="info-card">
          <h3>Mathematical Guarantees</h3>
          <p>
            Traditional voting: "Trust us, your vote was counted." <br/>
            <strong>Cryptographic voting: Mathematical proof your vote was counted.</strong>
          </p>
          <ul className="benefit-list">
            <li><strong>Transparent:</strong> Anyone can audit the process</li>
            <li><strong>Verifiable:</strong> Cryptographic proofs, not promises</li>
            <li><strong>Immutable:</strong> Once recorded, cannot be changed</li>
            <li><strong>Private:</strong> Your choice remains secret</li>
          </ul>
        </div>

        <div className="info-card">
          <h3>⚡ Performance</h3>
          <p>Complex cryptography, blazing fast execution:</p>
          <div className="perf-table">
            <div className="perf-row">
              <span className="perf-label">Vote Encryption</span>
              <span className="perf-value">~2ms</span>
            </div>
            <div className="perf-row">
              <span className="perf-label">Signature Generation</span>
              <span className="perf-value">~0.3ms</span>
            </div>
            <div className="perf-row">
              <span className="perf-label">Merkle Proof</span>
              <span className="perf-value">~0.2ms</span>
            </div>
            <div className="perf-row">
              <span className="perf-label">Full Verification</span>
              <span className="perf-value">~100ms</span>
            </div>
          </div>
        </div>

        <div className="info-card">
          <h3>🔒 Cryptographic Stack</h3>
          <div className="stack-table">
            <div className="stack-row">
              <span className="stack-label">Encryption</span>
              <span className="stack-value">XSalsa20-Poly1305</span>
            </div>
            <div className="stack-row">
              <span className="stack-label">Key Exchange</span>
              <span className="stack-value">Curve25519 (X25519)</span>
            </div>
            <div className="stack-row">
              <span className="stack-label">Signatures</span>
              <span className="stack-value">Ed25519</span>
            </div>
            <div className="stack-row">
              <span className="stack-label">Hashing</span>
              <span className="stack-value">SHA3-256 / SHA3-512</span>
            </div>
            <div className="stack-row">
              <span className="stack-label">ZK Proofs</span>
              <span className="stack-value">Schnorr (Groth16 ready)</span>
            </div>
            <div className="stack-row">
              <span className="stack-label">Merkle Trees</span>
              <span className="stack-value">SHA3-256</span>
            </div>
          </div>
        </div>
      </div>

      <div className="comparison-section">
        <h2>Traditional vs. Cryptographic Voting</h2>
        <div className="comparison-table">
          <div className="comparison-column bad-column">
            <h3>❌ Traditional Systems (Dominion, ES&S, etc.)</h3>
            <ul>
              <li>❌ Trust election officials blindly</li>
              <li>❌ No way to verify your vote</li>
              <li>❌ Centralized points of failure</li>
              <li>❌ Black box tallying</li>
              <li>❌ Vulnerable to insider attacks</li>
              <li>❌ No public audit trail</li>
            </ul>
          </div>

          <div className="comparison-column good-column">
            <h3>Trustless Voting (This System)</h3>
            <ul>
              <li>[✓] Zero-trust cryptographic proofs</li>
              <li>[✓] Verify your vote was counted</li>
              <li>[✓] Distributed ledger (no SPOF)</li>
              <li>[✓] Transparent cryptographic tally</li>
              <li>[✓] Threshold crypto (3-of-5 keys)</li>
              <li>[✓] Public blockchain anchoring</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="cta-section">
        <h2>Try It Yourself</h2>
        <p>Cast a real encrypted vote or verify an existing one:</p>
        <div className="cta-buttons">
          <Link to="/elections" className="btn btn-primary btn-lg">
            View Elections →
          </Link>
          <Link to="/verify" className="btn btn-secondary btn-lg">
            Verify a Vote →
          </Link>
          <Link to="/player/f20109ec-a798-4b71-9579-9032088010b9" className="btn btn-secondary btn-lg">
            Watch 2024 Replay →
          </Link>
        </div>
      </div>
    </div>
  );
}
