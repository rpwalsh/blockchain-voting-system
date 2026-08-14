/**
 * CRYPTOGRAPHY ENGINE UNIT TESTS
 * ================================
 * Comprehensive tests for all cryptographic primitives
 * 
 * Tests cover:
 * - Key generation
 * - Encryption/Decryption
 * - Digital signatures
 * - Hashing functions
 * - Merkle tree operations
 * - Timing attack resistance
 * - Edge cases and failure modes
 */

import crypto from '../../crypto/engine';
import { randomBytes } from 'crypto';

describe('Cryptography Engine - Key Generation', () => {
  test('should generate valid Ed25519 key pair', () => {
    const keyPair = crypto.generateKeyPair();
    
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
    expect(typeof keyPair.publicKey).toBe('string');
    expect(typeof keyPair.privateKey).toBe('string');
    expect(keyPair.publicKey.length).toBeGreaterThan(0);
    expect(keyPair.privateKey.length).toBeGreaterThan(0);
  });

  test('should generate unique key pairs', () => {
    const keyPair1 = crypto.generateKeyPair();
    const keyPair2 = crypto.generateKeyPair();
    
    expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
  });

  test('should generate valid election key pair', () => {
    const keyPair = crypto.generateElectionKeyPair();
    
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
  });

  test('should generate cryptographically secure voting tokens', () => {
    const token1 = crypto.generateVotingToken();
    const token2 = crypto.generateVotingToken();

    expect(token1.length).toBeGreaterThan(40);
    expect(token2.length).toBeGreaterThan(40);
    expect(token1).not.toBe(token2);
  });

  test('generateVotingToken never throws (regression: it used to, always)', () => {
    // generateVotingToken briefly had a per-token Shannon entropy self-check
    // that was mathematically incapable of passing for a 32-byte sample
    // (max achievable empirical entropy for n=32 is log2(32)=5 bits, the
    // check required 7.5) - it rejected 100% of real randomBytes() output.
    // See the note on generateVotingToken in crypto/engine.ts.
    for (let i = 0; i < 25; i++) {
      expect(() => crypto.generateVotingToken()).not.toThrow();
    }
  });
});

describe('Cryptography Engine - Vote Encryption', () => {
  const electionKeys = crypto.generateElectionKeyPair();

  test('should encrypt vote successfully', () => {
    const candidateId = 'candidate-123';
    const encrypted = crypto.encryptVote(candidateId, electionKeys.publicKey);
    
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.nonce).toBeDefined();
    expect(encrypted.ephemeralPublicKey).toBeDefined();
    expect(encrypted.version).toBe('v2-enhanced');
    expect(encrypted.algorithm).toBe('curve25519-xsalsa20-poly1305');
  });

  test('should decrypt vote successfully', () => {
    const candidateId = 'candidate-456';
    const encrypted = crypto.encryptVote(candidateId, electionKeys.publicKey);
    const decrypted = crypto.decryptVote(encrypted, electionKeys.privateKey);
    
    expect(decrypted).toBe(candidateId);
  });

  test('should fail to decrypt with wrong key', () => {
    const candidateId = 'candidate-789';
    const wrongKeys = crypto.generateElectionKeyPair();
    const encrypted = crypto.encryptVote(candidateId, electionKeys.publicKey);
    
    expect(() => {
      crypto.decryptVote(encrypted, wrongKeys.privateKey);
    }).toThrow();
  });

  test('should produce different ciphertexts for same vote', () => {
    const candidateId = 'candidate-same';
    const encrypted1 = crypto.encryptVote(candidateId, electionKeys.publicKey);
    const encrypted2 = crypto.encryptVote(candidateId, electionKeys.publicKey);
    
    // Due to random nonce, ciphertexts should differ
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    expect(encrypted1.nonce).not.toBe(encrypted2.nonce);
  });
});

describe('Cryptography Engine - Digital Signatures', () => {
  const keyPair = crypto.generateKeyPair();
  const testData = 'This is critical election data';

  test('should sign data successfully', () => {
    const signature = crypto.signData(testData, keyPair.privateKey);
    
    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');
    expect(signature.length).toBeGreaterThan(0);
  });

  test('should verify valid signature', () => {
    const signature = crypto.signData(testData, keyPair.privateKey);
    const isValid = crypto.verifySignature(testData, signature, keyPair.publicKey);
    
    expect(isValid).toBe(true);
  });

  test('should reject invalid signature', () => {
    const signature = crypto.signData(testData, keyPair.privateKey);
    const tamperedData = testData + ' TAMPERED';
    const isValid = crypto.verifySignature(tamperedData, signature, keyPair.publicKey);
    
    expect(isValid).toBe(false);
  });

  test('should reject signature with wrong public key', () => {
    const otherKeyPair = crypto.generateKeyPair();
    const signature = crypto.signData(testData, keyPair.privateKey);
    const isValid = crypto.verifySignature(testData, signature, otherKeyPair.publicKey);
    
    expect(isValid).toBe(false);
  });
});

describe('Cryptography Engine - Hashing', () => {
  // Use a fixed test token since generateVotingToken has entropy checks
  const testToken = 'SGVsbG9Xb3JsZFRlc3RUb2tlbjEyMzQ1Njc4OTA='; // base64 test value
  
  test('should hash voting token consistently', () => {
    const hash1 = crypto.hashVotingToken(testToken);
    const hash2 = crypto.hashVotingToken(testToken);
    
    expect(hash1).toBe(hash2);
  });

  test('should produce different hashes for different tokens', () => {
    const token1 = 'VGVzdFRva2VuT25lQWJjZGVmZ2hpamtsbW5vcA==';
    const token2 = 'VGVzdFRva2VuVHdvWHl6MTIzNDU2Nzg5MDEyMw==';
    const hash1 = crypto.hashVotingToken(token1);
    const hash2 = crypto.hashVotingToken(token2);
    
    expect(hash1).not.toBe(hash2);
  });

  test('should create identity hash with salt', () => {
    const voterId = 'SSN-123-45-6789';
    const salt = crypto.generateChallenge();
    const hash = crypto.createIdentityHash(voterId, salt);
    
    expect(hash).toBeDefined();
    expect(hash.length).toBeGreaterThan(0);
  });

  test('should hash IP addresses consistently', () => {
    const ip = '192.168.1.1';
    const salt = '2026-01-10';
    const hash1 = crypto.hashIPAddress(ip, salt);
    const hash2 = crypto.hashIPAddress(ip, salt);
    
    expect(hash1).toBe(hash2);
  });
});

describe('Cryptography Engine - Merkle Tree', () => {
  test('should create Merkle tree from leaves', () => {
    const leaves = ['vote1', 'vote2', 'vote3', 'vote4'];
    const tree = new crypto.MerkleTree(leaves);
    const root = tree.getRoot();
    
    expect(root).toBeDefined();
    expect(typeof root).toBe('string');
  });

  test('should generate valid Merkle proof', () => {
    const leaves = ['vote1', 'vote2', 'vote3', 'vote4'];
    const tree = new crypto.MerkleTree(leaves);
    const proof = tree.getProof(1);
    
    expect(proof.root).toBeDefined();
    expect(proof.proof).toBeInstanceOf(Array);
    expect(proof.leaf).toBeDefined();
    expect(proof.index).toBe(1);
    // Domain-separated leaf/node hashing (RFC 6962-style fix) changed this
    // label - see docs/protocol.md, "Stage: Ballot inclusion".
    expect(proof.algorithm).toBe('sha3-256-domain-separated');
  });

  test('should verify valid Merkle proof', () => {
    const leaves = ['vote1', 'vote2', 'vote3', 'vote4'];
    const tree = new crypto.MerkleTree(leaves);
    const proof = tree.getProof(2);
    const isValid = crypto.MerkleTree.verifyProof(proof);
    
    expect(isValid).toBe(true);
  });

  test('should reject invalid Merkle proof', () => {
    const leaves = ['vote1', 'vote2', 'vote3', 'vote4'];
    const tree = new crypto.MerkleTree(leaves);
    const proof = tree.getProof(1);
    proof.siblings[0].hash = 'tampered-hash';
    const isValid = crypto.MerkleTree.verifyProof(proof);
    
    expect(isValid).toBe(false);
  });

  test('should handle single leaf Merkle tree', () => {
    const leaves = ['only-vote'];
    const tree = new crypto.MerkleTree(leaves);
    const root = tree.getRoot();
    const proof = tree.getProof(0);
    const isValid = crypto.MerkleTree.verifyProof(proof);
    
    expect(root).toBeDefined();
    expect(isValid).toBe(true);
  });
});

describe('Cryptography Engine - Zero-Knowledge Proofs', () => {
  // Use fixed test token to avoid entropy issues
  const testToken = 'VGVzdFRva2VuRm9yWktQcm9vZlRlc3RpbmdBYmM=';
  
  test('should generate ZK proof for valid token', async () => {
    const challenge = crypto.generateChallenge();
    const proof = await crypto.generateTokenValidityProof(testToken, challenge);

    expect(proof.proof).toBeDefined();
    expect(proof.publicInputs).toBeInstanceOf(Array);
    expect(proof.version).toBeDefined();
    expect(proof.protocol).toBe('groth16');
    expect(proof.curve).toBe('bn128');
  });

  test('should verify valid ZK proof with correct publicInputs', async () => {
    const challenge = crypto.generateChallenge();
    const proof = await crypto.generateTokenValidityProof(testToken, challenge);

    // Raw pairing check against the circuit's own public signals
    // ([validityFlag, nullifier, tokenHashCommitment, challengeHash]) -
    // should pass real Groth16 verification regardless of what they mean.
    const isValid = await crypto.verifyZKProof(proof, proof.publicInputs);

    expect(isValid).toBe(true);
  });

  test('should reject ZK proof with mismatched publicInputs', async () => {
    const challenge = crypto.generateChallenge();
    const proof = await crypto.generateTokenValidityProof(testToken, challenge);

    // Use wrong public inputs
    const wrongInputs = ['1234567890123456789'];
    const isValid = await crypto.verifyZKProof(proof, wrongInputs);

    expect(isValid).toBe(false);
  });

  test('should reject ZK proof with different input length', async () => {
    const challenge = crypto.generateChallenge();
    const proof = await crypto.generateTokenValidityProof(testToken, challenge);

    // Use wrong number of public inputs
    const wrongInputs = ['1', '2'];
    const isValid = await crypto.verifyZKProof(proof, wrongInputs);

    expect(isValid).toBe(false);
  });
});

describe('Cryptography Engine - Timing Attack Resistance', () => {
  test('should use constant-time comparison', () => {
    const str1 = 'secret-token-12345';
    const str2 = 'secret-token-12345';
    const str3 = 'secret-token-99999';
    
    const result1 = crypto.constantTimeEqual(str1, str2);
    const result2 = crypto.constantTimeEqual(str1, str3);
    
    expect(result1).toBe(true);
    expect(result2).toBe(false);
  });

  test('constant-time comparison should handle different lengths', () => {
    const short = 'short';
    const long = 'much-longer-string';
    
    const result = crypto.constantTimeEqual(short, long);
    expect(result).toBe(false);
  });
});

describe('Cryptography Engine - Receipt Generation', () => {
  test('should generate unique receipt hashes', () => {
    const voteData = 'encrypted-vote-data';
    const receipt1 = crypto.createReceiptHash(voteData);
    const receipt2 = crypto.createReceiptHash(voteData);
    
    // Should be different due to random salt
    expect(receipt1).not.toBe(receipt2);
  });

  test('should generate valid receipt format', () => {
    const voteData = 'vote-123';
    const receipt = crypto.createReceiptHash(voteData);
    
    expect(receipt).toBeDefined();
    expect(typeof receipt).toBe('string');
    expect(receipt.length).toBeGreaterThan(0);
  });
});

describe('Cryptography Engine - Challenge Generation', () => {
  test('should generate cryptographically random challenges', () => {
    const challenge1 = crypto.generateChallenge();
    const challenge2 = crypto.generateChallenge();
    
    expect(challenge1).not.toBe(challenge2);
    expect(challenge1.length).toBeGreaterThan(40); // Base64 of 32 bytes
  });
});

describe('Cryptography Engine - Edge Cases', () => {
  test('should reject empty Merkle tree', () => {
    expect(() => {
      new crypto.MerkleTree([]);
    }).toThrow();
  });

  test('should handle very long vote data', () => {
    const electionKeys = crypto.generateElectionKeyPair();
    const longCandidateId = 'c'.repeat(1000);
    
    const encrypted = crypto.encryptVote(longCandidateId, electionKeys.publicKey);
    const decrypted = crypto.decryptVote(encrypted, electionKeys.privateKey);
    
    expect(decrypted).toBe(longCandidateId);
  });

  test('should handle special characters in data', () => {
    const keyPair = crypto.generateKeyPair();
    const specialData = '!@#$%^&*()_+{}|:<>?~[]\\;\',./';
    
    const signature = crypto.signData(specialData, keyPair.privateKey);
    const isValid = crypto.verifySignature(specialData, signature, keyPair.publicKey);
    
    expect(isValid).toBe(true);
  });
});
