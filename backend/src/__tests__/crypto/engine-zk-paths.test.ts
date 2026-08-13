/**
 * ZK-SNARK Path Coverage Tests
 *
 * These run against the real compiled token_validity circuit under
 * circuits/build/ (see circuits/README.md) - no fs/snarkjs mocking.
 * A real Groth16 proof is generated and verified on every run.
 */

import * as crypto from '../../crypto/engine';

describe('Crypto Engine - ZK-SNARK Paths', () => {
  describe('token_validity circuit (real Groth16)', () => {
    it('generates a real Groth16 proof for a voting token', async () => {
      const token = crypto.generateVotingToken();
      const challenge = crypto.generateChallenge();

      const proof = await crypto.generateTokenValidityProof(token, challenge);

      expect(proof.protocol).toBe('groth16');
      expect(proof.curve).toBe('bn128');
      // [validityFlag, nullifier, tokenHashCommitment, challengeHash]
      expect(proof.publicInputs).toHaveLength(4);
      expect(proof.publicInputs[0]).toBe('1');
      const parsed = JSON.parse(proof.proof);
      expect(parsed.pi_a).toBeDefined();
      expect(parsed.pi_b).toBeDefined();
      expect(parsed.pi_c).toBeDefined();
    });

    it('verifies a real proof against the token\'s commitment and the issued challenge', async () => {
      const token = crypto.generateVotingToken();
      const challenge = crypto.generateChallenge();
      const proof = await crypto.generateTokenValidityProof(token, challenge);
      const commitment = await crypto.computeTokenCommitment(token);

      const verified = await crypto.verifyTokenValidityProof(proof, commitment, challenge);
      expect(verified).toBe(true);
    });

    it('rejects a valid proof checked against the wrong token commitment', async () => {
      const token = crypto.generateVotingToken();
      const otherToken = crypto.generateVotingToken();
      const challenge = crypto.generateChallenge();
      const proof = await crypto.generateTokenValidityProof(token, challenge);
      const wrongCommitment = await crypto.computeTokenCommitment(otherToken);

      const verified = await crypto.verifyTokenValidityProof(proof, wrongCommitment, challenge);
      expect(verified).toBe(false);
    });

    it('rejects a valid proof checked against a stale (different) challenge', async () => {
      const token = crypto.generateVotingToken();
      const challenge = crypto.generateChallenge();
      const proof = await crypto.generateTokenValidityProof(token, challenge);
      const commitment = await crypto.computeTokenCommitment(token);

      const verified = await crypto.verifyTokenValidityProof(proof, commitment, crypto.generateChallenge());
      expect(verified).toBe(false);
    });

    it('rejects a tampered proof even against the correct commitment and challenge', async () => {
      const token = crypto.generateVotingToken();
      const challenge = crypto.generateChallenge();
      const proof = await crypto.generateTokenValidityProof(token, challenge);
      const commitment = await crypto.computeTokenCommitment(token);

      const forgedProof = JSON.parse(proof.proof);
      forgedProof.pi_a[0] = '1';
      const tampered = { ...proof, proof: JSON.stringify(forgedProof) };

      const verified = await crypto.verifyTokenValidityProof(tampered, commitment, challenge);
      expect(verified).toBe(false);
    });

    it('produces a different commitment for different tokens', async () => {
      const a = await crypto.computeTokenCommitment(crypto.generateVotingToken());
      const b = await crypto.computeTokenCommitment(crypto.generateVotingToken());
      expect(a).not.toBe(b);
    });

    it('produces a different nullifier for the same token across two challenges (anti-replay)', async () => {
      const token = crypto.generateVotingToken();
      const proofA = await crypto.generateTokenValidityProof(token, crypto.generateChallenge());
      const proofB = await crypto.generateTokenValidityProof(token, crypto.generateChallenge());
      expect(proofA.publicInputs[1]).not.toBe(proofB.publicInputs[1]);
    });

    it('produces the same commitment for the same token across multiple proofs', async () => {
      const token = crypto.generateVotingToken();
      const commitmentA = await crypto.computeTokenCommitment(token);
      const commitmentB = await crypto.computeTokenCommitment(token);
      expect(commitmentA).toBe(commitmentB);
    });
  });

  describe('uncompiled circuit fallback', () => {
    it('falls back to a non-ZK commitment when no circuit is compiled for it', async () => {
      const proof = await crypto.generateZKProof({ some: 'witness' }, null, 'not-a-real-circuit');
      expect(proof.protocol).toBe('fiat-shamir-fallback');
    });

    it('never accepts a fallback proof as a verified Groth16 proof', async () => {
      const proof = await crypto.generateZKProof({ some: 'witness' }, null, 'not-a-real-circuit');
      const verified = await crypto.verifyZKProof(proof, proof.publicInputs);
      expect(verified).toBe(false);
    });

    it('generateVoteValidityProof uses the fallback (no vote-validity circuit compiled yet)', async () => {
      const encryptedVote = crypto.encryptVote('candidate-1', crypto.generateElectionKeyPair().publicKey);
      const proofJson = await crypto.generateVoteValidityProof(encryptedVote, ['candidate-1', 'candidate-2']);
      const proof = JSON.parse(proofJson);
      expect(proof.protocol).toBe('fiat-shamir-fallback');
    });
  });

  describe('verifyZKProof protocol guard', () => {
    it('rejects non-groth16 proofs outright, regardless of publicInputs', async () => {
      const fakeProof: crypto.ZKProof = {
        proof: 'anything',
        publicInputs: ['x'],
        curve: 'bn128',
        protocol: 'fiat-shamir-fallback',
        version: 'uncompiled-circuit',
      };
      const verified = await crypto.verifyZKProof(fakeProof, ['x']);
      expect(verified).toBe(false);
    });
  });
});
