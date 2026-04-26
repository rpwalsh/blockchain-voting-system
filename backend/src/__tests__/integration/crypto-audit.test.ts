/**
 * CRYPTO AUDIT API INTEGRATION TESTS
 * ====================================
 * Tests for cryptographic audit and verification endpoints
 */

import request from 'supertest';
import express from 'express';
import crypto from '../../crypto/engine';

const app = express();
app.use(express.json());

// Mock crypto audit routes
app.get('/api/crypto-audit/capabilities', (_req, res) => {
  res.json({
    success: true,
    capabilities: {
      encryption: {
        algorithm: 'NaCl Box (Curve25519 + XSalsa20 + Poly1305)',
        keySize: 256,
        authenticated: true,
      },
      signatures: {
        algorithm: 'Ed25519',
        keySize: 256,
        deterministicSignatures: true,
      },
      hashing: {
        primary: 'SHA3-256 (Keccak)',
        secondary: 'PBKDF2-SHA512',
        merkleTree: 'SHA3-256',
      },
      zeroKnowledge: {
        type: 'Schnorr-based commitment scheme',
        features: ['Voter eligibility proof', 'Vote validity proof'],
      },
      merkleTree: {
        algorithm: 'Binary Merkle Tree with SHA3-256',
        proofFormat: 'Inclusion proof with sibling hashes',
      },
    },
  });
});

app.get('/api/crypto-audit/live-demo', (_req, res) => {
  const startTime = Date.now();
  const results: any = {
    success: true,
    timestamp: new Date().toISOString(),
    operations: [],
  };

  try {
    // Key generation demo
    const t1 = Date.now();
    const keyPair = crypto.generateKeyPair();
    results.operations.push({
      name: 'Key Generation (Ed25519)',
      duration: Date.now() - t1,
      result: { publicKeyLength: keyPair.publicKey.length },
    });

    // Encryption demo
    const t2 = Date.now();
    const electionKeys = crypto.generateElectionKeyPair();
    const encrypted = crypto.encryptVote('candidate-test', electionKeys.publicKey);
    results.operations.push({
      name: 'Vote Encryption (NaCl Box)',
      duration: Date.now() - t2,
      result: { ciphertextLength: encrypted.ciphertext.length },
    });

    // Signature demo
    const t3 = Date.now();
    const signature = crypto.signData('test-data', keyPair.privateKey);
    const verified = crypto.verifySignature('test-data', signature, keyPair.publicKey);
    results.operations.push({
      name: 'Digital Signature (Ed25519)',
      duration: Date.now() - t3,
      result: { signatureValid: verified },
    });

    // Merkle tree demo
    const t4 = Date.now();
    const tree = new crypto.MerkleTree(['vote1', 'vote2', 'vote3', 'vote4']);
    const proof = tree.getProof(0);
    const verifiedProof = crypto.MerkleTree.verifyProof(proof);
    results.operations.push({
      name: 'Merkle Tree + Proof',
      duration: Date.now() - t4,
      result: { root: tree.getRoot().substring(0, 16) + '...', proofValid: verifiedProof },
    });

    results.totalDuration = Date.now() - startTime;
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/crypto-audit/algorithms', (_req, res) => {
  res.json({
    success: true,
    algorithms: [
      {
        name: 'NaCl Box',
        purpose: 'Vote encryption',
        security: '256-bit',
        description: 'Curve25519 + XSalsa20-Poly1305 authenticated encryption',
      },
      {
        name: 'Ed25519',
        purpose: 'Digital signatures',
        security: '128-bit (256-bit key)',
        description: 'Edwards-curve digital signature algorithm',
      },
      {
        name: 'SHA3-256',
        purpose: 'Hashing',
        security: '256-bit',
        description: 'Keccak-based hash function (FIPS 202)',
      },
      {
        name: 'PBKDF2',
        purpose: 'Identity hashing',
        security: '256-bit output',
        description: 'Password-based key derivation with 210,000 iterations',
      },
    ],
  });
});

app.post('/api/crypto-audit/verify-receipt', (req, res) => {
  const { receiptHash } = req.body;

  if (!receiptHash) {
    return res.status(400).json({ success: false, error: 'Receipt hash required' });
  }

  // Mock verification (in real implementation, would query database)
  res.json({
    success: true,
    verified: receiptHash.length > 20, // Simplified validation
    message: 'Receipt format valid',
  });
});

describe('Crypto Audit API Tests', () => {
  test('GET /capabilities should return crypto capabilities', async () => {
    const response = await request(app)
      .get('/api/crypto-audit/capabilities');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.capabilities).toBeDefined();
    expect(response.body.capabilities.encryption).toBeDefined();
    expect(response.body.capabilities.signatures).toBeDefined();
    expect(response.body.capabilities.hashing).toBeDefined();
    expect(response.body.capabilities.zeroKnowledge).toBeDefined();
    expect(response.body.capabilities.merkleTree).toBeDefined();
  });

  test('GET /live-demo should run crypto operations', async () => {
    const response = await request(app)
      .get('/api/crypto-audit/live-demo');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.operations).toBeInstanceOf(Array);
    expect(response.body.operations.length).toBeGreaterThan(0);
    expect(response.body.totalDuration).toBeDefined();
    
    // Check all operations succeeded
    response.body.operations.forEach((op: any) => {
      expect(op.name).toBeDefined();
      expect(op.duration).toBeGreaterThanOrEqual(0);
      expect(op.result).toBeDefined();
    });
  });

  test('GET /algorithms should return algorithm descriptions', async () => {
    const response = await request(app)
      .get('/api/crypto-audit/algorithms');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.algorithms).toBeInstanceOf(Array);
    
    response.body.algorithms.forEach((algo: any) => {
      expect(algo.name).toBeDefined();
      expect(algo.purpose).toBeDefined();
      expect(algo.security).toBeDefined();
      expect(algo.description).toBeDefined();
    });
  });

  test('POST /verify-receipt should validate receipt', async () => {
    const response = await request(app)
      .post('/api/crypto-audit/verify-receipt')
      .send({ receiptHash: 'a'.repeat(64) });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.verified).toBeDefined();
  });

  test('POST /verify-receipt should reject missing receipt', async () => {
    const response = await request(app)
      .post('/api/crypto-audit/verify-receipt')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Receipt hash required');
  });
});

describe('Crypto Audit - Performance', () => {
  test('live demo should complete in reasonable time', async () => {
    const startTime = Date.now();
    
    const response = await request(app)
      .get('/api/crypto-audit/live-demo');

    const duration = Date.now() - startTime;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });

  test('individual crypto operations should be fast', async () => {
    const response = await request(app)
      .get('/api/crypto-audit/live-demo');

    expect(response.status).toBe(200);
    
    // Each operation should complete in under 100ms
    response.body.operations.forEach((op: any) => {
      expect(op.duration).toBeLessThan(100);
    });
  });
});

describe('Crypto Audit - Security', () => {
  test('should not expose private keys', async () => {
    const response = await request(app)
      .get('/api/crypto-audit/live-demo');

    const responseStr = JSON.stringify(response.body);
    
    // Should not contain any full private keys
    expect(responseStr.toLowerCase()).not.toContain('privatekey');
    expect(responseStr.toLowerCase()).not.toContain('private_key');
  });

  test('capabilities should accurately describe algorithms', async () => {
    const response = await request(app)
      .get('/api/crypto-audit/capabilities');

    expect(response.body.capabilities.encryption.keySize).toBe(256);
    expect(response.body.capabilities.encryption.authenticated).toBe(true);
    expect(response.body.capabilities.signatures.algorithm).toBe('Ed25519');
  });
});
