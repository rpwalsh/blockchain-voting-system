/**
 * Crypto Engine Helper Functions Coverage Tests
 * Tests for uncovered utility functions and edge cases
 */

import {
  signData,
  verifySignature,
  createReceiptHash,
  constantTimeEqual,
  MerkleTree,
  generateChallenge,
  hashIPAddress,
  generateKeyPair,
} from '../../crypto/engine';

describe('Crypto Engine - Helper Functions Coverage', () => {
  describe('Signature Edge Cases', () => {
    it('should handle empty message signature', () => {
      const keyPair = generateKeyPair();
      const message = '';
      const signature = signData(message, keyPair.privateKey);
      const isValid = verifySignature(message, signature, keyPair.publicKey);
      expect(isValid).toBe(true);
    });

    it('should handle very long message signature', () => {
      const keyPair = generateKeyPair();
      const message = 'x'.repeat(10000);
      const signature = signData(message, keyPair.privateKey);
      const isValid = verifySignature(message, signature, keyPair.publicKey);
      expect(isValid).toBe(true);
    });

    it('should handle message with special characters and unicode', () => {
      const keyPair = generateKeyPair();
      const message = 'Test: 你好 émoji special chars!@#$%^&*()';
      const signature = signData(message, keyPair.privateKey);
      const isValid = verifySignature(message, signature, keyPair.publicKey);
      expect(isValid).toBe(true);
    });

    it('should reject signature with wrong public key', () => {
      const keyPair1 = generateKeyPair();
      const keyPair2 = generateKeyPair();
      const message = 'test message';
      
      const signature = signData(message, keyPair1.privateKey);
      const isValid = verifySignature(
        message,
        signature,
        keyPair2.publicKey
      );
      
      expect(isValid).toBe(false);
    });

    it('should reject tampered message', () => {
      const keyPair = generateKeyPair();
      const message = 'original message';
      const signature = signData(message, keyPair.privateKey);
      
      const tamperedMessage = 'tampered message';
      const isValid = verifySignature(
        tamperedMessage,
        signature,
        keyPair.publicKey
      );
      
      expect(isValid).toBe(false);
    });
  });

  describe('Merkle Tree Edge Cases', () => {
    it('should handle merkle tree with single leaf', () => {
      const leaves = ['single-leaf-hash'];
      const tree = new MerkleTree(leaves);
      const root = tree.getRoot();
      expect(root).toBeDefined();
      expect(typeof root).toBe('string');
    });

    it('should handle merkle tree with duplicate leaves', () => {
      const leaves = ['hash1', 'hash1', 'hash1', 'hash1'];
      const tree = new MerkleTree(leaves);
      const root = tree.getRoot();
      expect(root).toBeDefined();
    });

    it('should generate valid merkle proof for first and last leaf', () => {
      const leaves = ['hash1', 'hash2', 'hash3', 'hash4'];
      const tree = new MerkleTree(leaves);
      
      // Test proof for first leaf
      const proof1 = tree.getProof(0);
      expect(proof1).toBeDefined();
      expect(proof1.leaf).toBeDefined(); // Leaf is the hashed value
      expect(proof1.leaf.length).toBe(64); // SHA3-256 produces 64 hex chars
      expect(proof1.root).toBe(tree.getRoot());
      
      // Test proof for last leaf
      const proof2 = tree.getProof(3);
      expect(proof2).toBeDefined();
      expect(proof2.leaf).toBeDefined(); // Leaf is the hashed value
      expect(proof2.leaf.length).toBe(64); // SHA3-256 produces 64 hex chars
      expect(proof2.root).toBe(tree.getRoot());
    });

    it('should verify merkle proof correctly for all leaves', () => {
      const leaves = ['hash1', 'hash2', 'hash3', 'hash4', 'hash5'];
      const tree = new MerkleTree(leaves);
      
      for (let i = 0; i < leaves.length; i++) {
        const proof = tree.getProof(i);
        const isValid = MerkleTree.verifyProof(proof);
        expect(isValid).toBe(true);
      }
    });

    it('should reject invalid merkle proof with tampered leaf', () => {
      const leaves = ['hash1', 'hash2', 'hash3'];
      const tree = new MerkleTree(leaves);
      const proof = tree.getProof(0);
      
      // Tamper with proof
      const tamperedProof = {
        ...proof,
        leaf: 'tampered-leaf-data',
      };
      
      const isValid = MerkleTree.verifyProof(tamperedProof);
      expect(isValid).toBe(false);
    });

    it('should reject invalid merkle proof with tampered root', () => {
      const leaves = ['hash1', 'hash2', 'hash3'];
      const tree = new MerkleTree(leaves);
      const proof = tree.getProof(0);
      
      // Tamper with root
      const tamperedProof = {
        ...proof,
        root: 'tampered-root-hash',
      };
      
      const isValid = MerkleTree.verifyProof(tamperedProof);
      expect(isValid).toBe(false);
    });

    it('should handle odd number of leaves', () => {
      const leaves = ['hash1', 'hash2', 'hash3', 'hash4', 'hash5'];
      const tree = new MerkleTree(leaves);
      const root = tree.getRoot();
      expect(root).toBeDefined();
      
      // Verify all proofs
      for (let i = 0; i < leaves.length; i++) {
        const proof = tree.getProof(i);
        expect(MerkleTree.verifyProof(proof)).toBe(true);
      }
    });

    it('should handle large merkle tree', () => {
      const leaves = Array.from({ length: 100 }, (_, i) => `hash-${i}`);
      const tree = new MerkleTree(leaves);
      const root = tree.getRoot();
      expect(root).toBeDefined();
      
      // Verify random proofs
      const randomIndices = [0, 25, 50, 75, 99];
      for (const i of randomIndices) {
        const proof = tree.getProof(i);
        expect(MerkleTree.verifyProof(proof)).toBe(true);
      }
    });
  });

  describe('Receipt Hash Functions', () => {
    it('should generate hashes for same vote data', () => {
      const voteData = JSON.stringify({ candidate: 'A', timestamp: 1000 });
      const hash1 = createReceiptHash(voteData);
      const hash2 = createReceiptHash(voteData);
      
      // Hashes will be different due to random salt, but both should be valid
      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
      expect(typeof hash1).toBe('string');
      expect(typeof hash2).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
      expect(hash2.length).toBeGreaterThan(0);
    });

    it('should generate different receipt hashes for different votes', () => {
      const voteData1 = JSON.stringify({ candidate: 'A', timestamp: 1000 });
      const voteData2 = JSON.stringify({ candidate: 'B', timestamp: 2000 });
      
      const hash1 = createReceiptHash(voteData1);
      const hash2 = createReceiptHash(voteData2);
      
      // Should generate valid hashes
      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
      expect(hash1).not.toBe(hash2);
    });

    it('should handle complex vote objects', () => {
      const voteData = JSON.stringify({
        candidate: 'Candidate Name',
        election: 'Election ID',
        timestamp: Date.now(),
        metadata: { district: 'District 1', precinct: 'P-001' },
      });
      
      const hash = createReceiptHash(voteData);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should handle empty vote string', () => {
      const voteData = '{}';
      const hash = createReceiptHash(voteData);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should handle vote with unicode characters', () => {
      const voteData = JSON.stringify({
        candidate: '李明 (Li Ming)',
        notes: 'Test with émojis and àccents: 你好世界',
      });
      
      const hash = createReceiptHash(voteData);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });

  describe('Constant Time Equal', () => {
    it('should return true for equal strings', () => {
      const str1 = 'test-string-123';
      const str2 = 'test-string-123';
      expect(constantTimeEqual(str1, str2)).toBe(true);
    });

    it('should return false for different strings', () => {
      const str1 = 'test-string-123';
      const str2 = 'test-string-456';
      expect(constantTimeEqual(str1, str2)).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      const str1 = 'short';
      const str2 = 'much longer string';
      expect(constantTimeEqual(str1, str2)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(constantTimeEqual('', '')).toBe(true);
      expect(constantTimeEqual('', 'non-empty')).toBe(false);
    });

    it('should handle unicode strings', () => {
      const str1 = '你好世界';
      const str2 = '你好世界';
      const str3 = '你好地球';
      
      expect(constantTimeEqual(str1, str2)).toBe(true);
      expect(constantTimeEqual(str1, str3)).toBe(false);
    });
  });

  describe('Challenge Generation', () => {
    it('should generate unique challenges', () => {
      const challenge1 = generateChallenge();
      const challenge2 = generateChallenge();
      
      expect(challenge1).not.toBe(challenge2);
    });

    it('should generate challenges of sufficient length', () => {
      const challenge = generateChallenge();
      expect(challenge.length).toBeGreaterThan(20);
    });

    it('should generate base64 encoded challenges', () => {
      const challenge = generateChallenge();
      // Base64 regex
      const base64Regex = /^[A-Za-z0-9+/]+=*$/;
      expect(base64Regex.test(challenge)).toBe(true);
    });
  });

  describe('IP Address Hashing', () => {
    it('should hash IPv4 addresses consistently', () => {
      const ip = '192.168.1.1';
      const salt = 'daily-salt-value';
      const hash1 = hashIPAddress(ip, salt);
      const hash2 = hashIPAddress(ip, salt);
      
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
    });

    it('should hash IPv6 addresses consistently', () => {
      const ip = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const salt = 'daily-salt-value';
      const hash1 = hashIPAddress(ip, salt);
      const hash2 = hashIPAddress(ip, salt);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different IPs', () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';
      const salt = 'daily-salt-value';
      
      const hash1 = hashIPAddress(ip1, salt);
      const hash2 = hashIPAddress(ip2, salt);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle localhost addresses', () => {
      const salt = 'daily-salt-value';
      const hash1 = hashIPAddress('127.0.0.1', salt);
      const hash2 = hashIPAddress('::1', salt);
      
      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes with different salts', () => {
      const ip = '192.168.1.1';
      const hash1 = hashIPAddress(ip, 'salt1');
      const hash2 = hashIPAddress(ip, 'salt2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Key Pair Generation', () => {
    it('should generate unique key pairs', () => {
      const keyPair1 = generateKeyPair();
      const keyPair2 = generateKeyPair();
      
      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
    });

    it('should generate key pairs with correct algorithm', () => {
      const keyPair = generateKeyPair();
      
      expect(keyPair.algorithm).toBe('ed25519');
      expect(keyPair.created).toBeDefined();
      expect(typeof keyPair.created).toBe('number');
    });

    it('should generate valid key pairs for signing', () => {
      const keyPair = generateKeyPair();
      const message = 'test message';
      
      const signature = signData(message, keyPair.privateKey);
      const isValid = verifySignature(message, signature, keyPair.publicKey);
      
      expect(isValid).toBe(true);
    });
  });
});
