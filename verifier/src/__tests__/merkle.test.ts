import { MerkleTree, recomputeMerkleRoot, hashLeaf } from '../crypto/merkle';

describe('MerkleTree (standalone verifier reimplementation)', () => {
  it('verifies inclusion proofs for every leaf across odd and even leaf counts', () => {
    for (const count of [1, 2, 3, 4, 5, 7, 8, 13]) {
      const raw = Array.from({ length: count }, (_, i) => `ballot-${i}`);
      const tree = new MerkleTree(raw);
      for (let i = 0; i < count; i++) {
        const proof = tree.getProof(i);
        expect(recomputeMerkleRoot(proof)).toBe(tree.getRoot());
      }
    }
  });

  it('rejects a proof recomputed from a tampered leaf', () => {
    const tree = new MerkleTree(['a', 'b', 'c', 'd', 'e']);
    const proof = tree.getProof(2);
    const tampered = { ...proof, leaf: hashLeaf('tampered') };
    expect(recomputeMerkleRoot(tampered)).not.toBe(tree.getRoot());
  });

  it('rejects a proof with a tampered sibling', () => {
    const tree = new MerkleTree(['a', 'b', 'c', 'd', 'e']);
    const proof = tree.getProof(0);
    const tampered = {
      ...proof,
      siblings: proof.siblings.map((s, i) => (i === 0 ? { ...s, hash: hashLeaf('evil') } : s)),
    };
    expect(recomputeMerkleRoot(tampered)).not.toBe(tree.getRoot());
  });

  it('locates a raw leaf by index', () => {
    const tree = new MerkleTree(['x', 'y', 'z']);
    expect(tree.indexOfRawLeaf('y')).toBe(1);
    expect(tree.indexOfRawLeaf('missing')).toBe(-1);
  });

  it('rejects out-of-bounds proof requests', () => {
    const tree = new MerkleTree(['a']);
    expect(() => tree.getProof(1)).toThrow();
    expect(() => tree.getProof(-1)).toThrow();
  });
});
