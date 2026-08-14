import tally from '../../crypto/tally';

describe('tally crypto (real EC ElGamal + Shamir threshold decryption)', () => {
  it('encrypts and homomorphically sums a one-hot vote across multiple ballots, decrypting the correct per-candidate counts', () => {
    const { privateKey, publicKey } = tally.generateTallyKeyPair();
    const shares = tally.splitScalarShamir(privateKey, 3, 5);

    // 5 ballots across 3 candidates: A=2, B=1, C=2
    const choices = [0, 0, 1, 2, 2];
    const numCandidates = 3;
    const ballots = choices.map(choice => tally.encryptOneHot(choice, numCandidates, publicKey));

    const perCandidateSums = Array.from({ length: numCandidates }, (_, candidateIndex) =>
      tally.homomorphicSum(ballots.map(b => b[candidateIndex]))
    );

    const trustees = shares.slice(0, 3); // exactly threshold-many
    const counts = perCandidateSums.map(sum => {
      const partials = trustees.map(share => tally.computePartialDecryption(share, sum));
      for (const partial of partials) {
        const trustee = trustees.find(t => t.index === partial.index)!;
        expect(tally.verifyPartialDecryption(trustee.publicCommitment, sum, partial)).toBe(true);
      }
      const combined = tally.combinePartialDecryptions(partials);
      return tally.decryptSum(sum, combined, choices.length);
    });

    expect(counts).toEqual([2, 1, 2]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(choices.length);
  });

  it('produces the same combined decryption from any distinct threshold-sized subset of trustees', () => {
    const { privateKey, publicKey } = tally.generateTallyKeyPair();
    const shares = tally.splitScalarShamir(privateKey, 3, 5);
    const ciphertext = tally.encryptBit(1, publicKey);

    const subsetA = [shares[0], shares[1], shares[2]];
    const subsetB = [shares[2], shares[3], shares[4]];

    const combine = (subset: typeof shares) => {
      const partials = subset.map(share => tally.computePartialDecryption(share, ciphertext));
      return tally.combinePartialDecryptions(partials);
    };

    expect(combine(subsetA)).toEqual(combine(subsetB));
  });

  it('rejects a forged partial decryption (wrong point, valid-looking proof shape)', () => {
    const { privateKey, publicKey } = tally.generateTallyKeyPair();
    const shares = tally.splitScalarShamir(privateKey, 2, 3);
    const ciphertext = tally.encryptBit(1, publicKey);

    const honest = tally.computePartialDecryption(shares[0], ciphertext);
    const forged = { ...honest, point: tally.computePartialDecryption(shares[1], ciphertext).point };

    expect(tally.verifyPartialDecryption(shares[0].publicCommitment, ciphertext, forged)).toBe(false);
  });

  it('fails below-threshold combination silently produces a wrong (not the true) result rather than crashing', () => {
    // A real system must never accept a below-threshold result as final;
    // this just documents that math alone doesn't enforce the threshold -
    // routes/tally.ts is what refuses to certify without enough partials.
    const { privateKey, publicKey } = tally.generateTallyKeyPair();
    const shares = tally.splitScalarShamir(privateKey, 3, 5);
    const ciphertext = tally.encryptBit(1, publicKey);

    const tooFew = shares.slice(0, 2); // below threshold=3
    const partials = tooFew.map(share => tally.computePartialDecryption(share, ciphertext));
    const combined = tally.combinePartialDecryptions(partials);

    const correctCombined = tally.combinePartialDecryptions(
      shares.slice(0, 3).map(share => tally.computePartialDecryption(share, ciphertext))
    );
    expect(combined).not.toEqual(correctCombined);
  });

  it('decrypts a homomorphic sum of zero bits to zero (threshold=1 for simplicity)', () => {
    const { privateKey, publicKey } = tally.generateTallyKeyPair();
    const shares = tally.splitScalarShamir(privateKey, 1, 1);
    const ciphertexts = [tally.encryptBit(0, publicKey), tally.encryptBit(0, publicKey), tally.encryptBit(0, publicKey)];
    const sum = tally.homomorphicSum(ciphertexts);

    const partial = tally.computePartialDecryption(shares[0], sum);
    const combined = tally.combinePartialDecryptions([partial]);
    expect(tally.decryptSum(sum, combined, ciphertexts.length)).toBe(0);
  });
});
