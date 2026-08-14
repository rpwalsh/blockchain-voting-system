/**
 * Comprehensive Crypto Engine Tests
 * Tests for all cryptographic primitives
 */

import {
  splitSecretShamir,
  reconstructSecretShamir,
  generateTokenValidityProof,
  verifyTokenValidityProof,
  generateVoteValidityProof,
  computeTokenCommitment,
  signData,
  verifySignature,
  createReceiptHash,
  constantTimeEqual,
  hashIPAddress,
  generateBlockchainAnchor,
  generateChallenge,
} from '../../crypto/engine';
import { sha3_256 } from 'js-sha3';

describe('Shamir Secret Sharing', () => {
  describe('splitSecretShamir', () => {
    it('should split secret into shares', () => {
      const secret = Buffer.from('my-secret-key').toString('base64');
      const shares = splitSecretShamir(secret, 3, 5);
      
      expect(shares).toHaveLength(5);
      expect(shares[0].threshold).toBe(3);
      expect(shares[0].totalShares).toBe(5);
      expect(shares.every(s => s.share)).toBe(true);
      expect(shares.every(s => s.commitment)).toBe(true);
    });

    it('should create shares with unique indices', () => {
      const secret = Buffer.from('test-secret').toString('base64');
      const shares = splitSecretShamir(secret, 2, 4);
      
      const indices = shares.map(s => s.index);
      const uniqueIndices = new Set(indices);
      expect(uniqueIndices.size).toBe(4);
      expect(indices).toEqual([1, 2, 3, 4]);
    });

    it('should use default parameters', () => {
      const secret = Buffer.from('default-test').toString('base64');
      const shares = splitSecretShamir(secret);
      
      // Defaults: threshold=3, totalShares=5
      expect(shares).toHaveLength(5);
      expect(shares[0].threshold).toBe(3);
    });

    it('should create commitments for each share', () => {
      const secret = Buffer.from('committed').toString('base64');
      const shares = splitSecretShamir(secret, 2, 3);
      
      shares.forEach(share => {
        expect(share.commitment).toBeTruthy();
        expect(typeof share.commitment).toBe('string');
        expect(share.commitment.length).toBeGreaterThan(0);
      });
    });
  });

  describe('reconstructSecretShamir', () => {
    it('should reconstruct secret from threshold shares', () => {
      const originalSecret = Buffer.from('reconstruct-me').toString('base64');
      const shares = splitSecretShamir(originalSecret, 3, 5);
      
      // Use exactly threshold shares
      const reconstructed = reconstructSecretShamir(shares.slice(0, 3));
      expect(reconstructed).toBe(originalSecret);
    });

    it('should reconstruct with more than threshold shares', () => {
      const originalSecret = Buffer.from('extra-shares').toString('base64');
      const shares = splitSecretShamir(originalSecret, 2, 5);
      
      // Use 4 shares (more than threshold of 2)
      const reconstructed = reconstructSecretShamir(shares.slice(0, 4));
      expect(reconstructed).toBe(originalSecret);
    });

    it('should work with all shares', () => {
      const originalSecret = Buffer.from('all-shares').toString('base64');
      const shares = splitSecretShamir(originalSecret, 3, 5);
      
      const reconstructed = reconstructSecretShamir(shares);
      expect(reconstructed).toBe(originalSecret);
    });

    it('should throw error with insufficient shares', () => {
      const originalSecret = Buffer.from('insufficient').toString('base64');
      const shares = splitSecretShamir(originalSecret, 3, 5);
      
      // Try with only 2 shares when threshold is 3
      expect(() => {
        reconstructSecretShamir(shares.slice(0, 2));
      }).toThrow('Need at least 3 shares');
    });

    it('should work with non-contiguous share indices', () => {
      const originalSecret = Buffer.from('non-contiguous').toString('base64');
      const shares = splitSecretShamir(originalSecret, 3, 5);
      
      // Use shares 1, 3, 5 (skipping 2 and 4)
      const selectedShares = [shares[0], shares[2], shares[4]];
      const reconstructed = reconstructSecretShamir(selectedShares);
      expect(reconstructed).toBe(originalSecret);
    });
  });
});

describe('Token Validity Proofs', () => {
  describe('generateTokenValidityProof', () => {
    it('should generate a real Groth16 token validity proof', async () => {
      const token = Buffer.from('test-voting-token-' + Date.now()).toString('base64');
      const challenge = 'challenge-' + Date.now();

      const proof = await generateTokenValidityProof(token, challenge);

      expect(proof).toHaveProperty('proof');
      expect(proof).toHaveProperty('publicInputs');
      expect(proof).toHaveProperty('protocol');
      // Real Groth16 zk-SNARK, verified end-to-end below
      expect(proof.protocol).toBe('groth16');
    });

    it('should generate different proofs for different tokens', async () => {
      const challenge = 'same-challenge';
      const token1 = Buffer.from('token1').toString('base64');
      const token2 = Buffer.from('token2').toString('base64');
      const proof1 = await generateTokenValidityProof(token1, challenge);
      const proof2 = await generateTokenValidityProof(token2, challenge);

      expect(proof1.proof).not.toBe(proof2.proof);
      // index 2 is tokenHashCommitment; index 0 (validityFlag) is always '1'
      expect(proof1.publicInputs[2]).not.toBe(proof2.publicInputs[2]);
    });

    it('should include curve information', async () => {
      const token = Buffer.from('token').toString('base64');
      const proof = await generateTokenValidityProof(token, 'challenge');

      // Groth16 uses bn128 (Barreto-Naehrig) curve
      expect(proof.curve).toBe('bn128');
      expect(proof.version).toBe('snarkjs-0.7.x');
    });
  });

  describe('verifyTokenValidityProof', () => {
    it('verifies a valid proof against the token\'s real Poseidon commitment and issued challenge', async () => {
      const token = Buffer.from('valid-token-' + Date.now()).toString('base64');
      const challenge = 'challenge-' + Date.now();
      const proof = await generateTokenValidityProof(token, challenge);
      const commitment = await computeTokenCommitment(token);

      const result = await verifyTokenValidityProof(proof, commitment, challenge);
      expect(result).toBe(true);
    });

    it('rejects verification against an unrelated sha3 hash (not a Poseidon commitment)', async () => {
      const token = Buffer.from('another-token').toString('base64');
      const proof = await generateTokenValidityProof(token, 'chal');
      const unrelatedHash = sha3_256(token);

      const result = await verifyTokenValidityProof(proof, unrelatedHash, 'chal');
      expect(result).toBe(false);
    });

    it('rejects verification against the right commitment but a stale challenge', async () => {
      const token = Buffer.from('stale-challenge-token').toString('base64');
      const proof = await generateTokenValidityProof(token, 'original-challenge');
      const commitment = await computeTokenCommitment(token);

      const result = await verifyTokenValidityProof(proof, commitment, 'different-challenge');
      expect(result).toBe(false);
    });
  });
});

describe('Vote Validity Proofs', () => {
  describe('generateVoteValidityProof', () => {
    it('should generate a vote validity commitment', async () => {
      const encryptedVote = {
        ciphertext: 'encrypted-vote-data',
        nonce: 'random-nonce',
        commitment: 'vote-commitment',
        publicKey: 'election-public-key',
        ephemeralPublicKey: 'ephemeral-key',
        version: '1.0',
        algorithm: 'XSalsa20-Poly1305',
        timestamp: Date.now(),
      };
      const validCandidateIds = ['candidate1', 'candidate2', 'candidate3'];

      const proof = await generateVoteValidityProof(encryptedVote, validCandidateIds);

      expect(proof).toBeTruthy();
      expect(typeof proof).toBe('string');
      // No compiled circuit for vote-validity yet - this is the honest
      // fallback commitment, not a Groth16 proof (see engine.ts).
      expect(JSON.parse(proof).protocol).toBe('fiat-shamir-fallback');
    });

    it('should handle single candidate', async () => {
      const encryptedVote = {
        ciphertext: 'vote',
        nonce: 'nonce',
        commitment: 'commit',
        publicKey: 'key',
        ephemeralPublicKey: 'eph',
        version: '1.0',
        algorithm: 'XSalsa20-Poly1305',
        timestamp: Date.now(),
      };

      const proof = await generateVoteValidityProof(encryptedVote, ['solo-candidate']);
      expect(proof).toBeTruthy();
    });
  });
});

describe('Digital Signatures', () => {
  describe('signData', () => {
    it('should sign data with private key', () => {
      const data = 'important-data-to-sign';
      // Generate a real Ed25519 keypair for testing
      const { generateKeyPair } = require('../../crypto/engine');
      const keyPair = generateKeyPair();
      
      const signature = signData(data, keyPair.privateKey);
      
      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should produce different signatures for different data', () => {
      const { generateKeyPair } = require('../../crypto/engine');
      const keyPair = generateKeyPair();
      
      const sig1 = signData('data1', keyPair.privateKey);
      const sig2 = signData('data2', keyPair.privateKey);
      
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const data = 'signed-data';
      const { generateKeyPair } = require('../../crypto/engine');
      const keyPair = generateKeyPair();
      
      const signature = signData(data, keyPair.privateKey);
      const result = verifySignature(data, signature, keyPair.publicKey);
      
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const data = 'original-data';
      const { generateKeyPair } = require('../../crypto/engine');
      const keyPair = generateKeyPair();
      
      const signature = signData(data, keyPair.privateKey);
      // Try to verify with wrong data
      const result = verifySignature('modified-data', signature, keyPair.publicKey);
      
      expect(result).toBe(false);
    });

    it('should reject signature from wrong key', () => {
      const data = 'test-data';
      const { generateKeyPair } = require('../../crypto/engine');
      const keyPair1 = generateKeyPair();
      const keyPair2 = generateKeyPair();
      
      const signature = signData(data, keyPair1.privateKey);
      const result = verifySignature(data, signature, keyPair2.publicKey);
      
      expect(result).toBe(false);
    });
  });
});

describe('Receipt Hashing', () => {
  describe('createReceiptHash', () => {
    it('should create receipt hash', () => {
      const voteData = JSON.stringify({ 
        candidateId: 'candidate-123',
        timestamp: Date.now(),
      });
      
      const hash = createReceiptHash(voteData);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should create different hashes for different data', () => {
      const hash1 = createReceiptHash('vote1');
      const hash2 = createReceiptHash('vote2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should be non-deterministic (includes random salt for security)', () => {
      const voteData = 'same-vote';
      const hash1 = createReceiptHash(voteData);
      const hash2 = createReceiptHash(voteData);
      
      // Receipts include random salt to prevent rainbow table attacks
      expect(hash1).not.toBe(hash2);
    });

    it('should produce valid hex hash', () => {
      const hash = createReceiptHash('test-vote');
      
      // SHA3-256 produces 64 character hex string
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});

describe('Security Utilities', () => {
  describe('constantTimeEqual', () => {
    it('should return true for equal strings', () => {
      const str = 'secret-comparison-string';
      expect(constantTimeEqual(str, str)).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(constantTimeEqual('string1', 'string2')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(constantTimeEqual('short', 'much-longer-string')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(constantTimeEqual('', '')).toBe(true);
      expect(constantTimeEqual('', 'not-empty')).toBe(false);
    });
  });

  describe('hashIPAddress', () => {
    it('should hash IP address with daily salt', () => {
      const ip = '192.168.1.100';
      const dailySalt = '2026-01-10';
      
      const hash = hashIPAddress(ip, dailySalt);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    it('should produce different hashes for different IPs', () => {
      const dailySalt = '2026-01-10';
      const hash1 = hashIPAddress('192.168.1.1', dailySalt);
      const hash2 = hashIPAddress('192.168.1.2', dailySalt);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different salts', () => {
      const ip = '10.0.0.1';
      const hash1 = hashIPAddress(ip, '2026-01-10');
      const hash2 = hashIPAddress(ip, '2026-01-11');
      
      expect(hash1).not.toBe(hash2);
    });
  });
});

describe('Blockchain Integration', () => {
  describe('generateBlockchainAnchor', () => {
    it('should generate blockchain anchor', () => {
      const merkleRoot = sha3_256('test-votes-hash');
      
      const anchor = generateBlockchainAnchor(merkleRoot);
      
      expect(anchor).toHaveProperty('merkleRoot');
      expect(anchor).toHaveProperty('timestamp');
      expect(anchor).toHaveProperty('blockchain');
      expect(anchor.merkleRoot).toBe(merkleRoot);
    });

    it('is honestly labeled as a local simulation, not a real transaction', () => {
      // generateBlockchainAnchor() is a local commitment digest only - see
      // docs/cryptography.md. `transactionHash` and `blockNumber` are null,
      // making explicit that no real transaction exists. Real anchoring is
      // submitTimestampAnchor().
      const merkleRoot = sha3_256('votes-merkle-root');
      const anchor = generateBlockchainAnchor(merkleRoot, 'ethereum');

      expect(anchor.real).toBe(false);
      expect(anchor.transactionHash).toBeNull();
      expect(anchor.blockNumber).toBeNull();
      expect(anchor.localCommitment).toBeTruthy();
    });

    it('should create different anchors for different roots', () => {
      const root1 = sha3_256('root1');
      const root2 = sha3_256('root2');
      const anchor1 = generateBlockchainAnchor(root1);
      const anchor2 = generateBlockchainAnchor(root2);
      
      expect(anchor1.merkleRoot).not.toBe(anchor2.merkleRoot);
    });
  });

  describe('generateChallenge', () => {
    it('should generate challenge', () => {
      const challenge = generateChallenge();
      
      expect(challenge).toBeTruthy();
      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBeGreaterThan(0);
    });

    it('should generate unique challenges', () => {
      const challenge1 = generateChallenge();
      const challenge2 = generateChallenge();
      
      expect(challenge1).not.toBe(challenge2);
    });

    it('should generate 32-byte challenge', () => {
      const challenge = generateChallenge();
      // Base64 encoding of 32 bytes = 44 characters
      expect(challenge.length).toBeGreaterThanOrEqual(40);
    });
  });
});
