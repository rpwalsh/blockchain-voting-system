/**
 * Merkle tree reconstruction and proof verification, reimplemented
 * standalone to mirror backend/src/crypto/engine.ts's MerkleTree class
 * (RFC 6962-style leaf/node domain separation, odd-node promotion instead
 * of self-hashing duplicates). See docs/protocol.md, "Stage: Ballot
 * inclusion" for the rationale. This file must stay algorithmically
 * identical to the backend's tree without importing it.
 */

import { DOMAIN, domainHashRaw } from './canonical';

export interface MerkleSibling {
  left: boolean;
  hash: string;
  empty?: boolean;
}

export interface MerkleProof {
  root: string;
  leaf: string;
  index: number;
  siblings: MerkleSibling[];
}

export class MerkleTree {
  private readonly leaves: string[];
  private readonly levels: string[][];

  constructor(rawLeaves: string[]) {
    if (rawLeaves.length === 0) throw new Error('Cannot build a Merkle tree over zero leaves');
    this.leaves = rawLeaves.map(leaf => domainHashRaw(DOMAIN.ELECTION_MERKLE_LEAF, leaf));
    this.levels = MerkleTree.build(this.leaves);
  }

  private static build(leaves: string[]): string[][] {
    const levels: string[][] = [leaves];

    while (levels[levels.length - 1].length > 1) {
      const current = levels[levels.length - 1];
      const next: string[] = [];

      for (let i = 0; i < current.length; i += 2) {
        if (i + 1 < current.length) {
          next.push(domainHashRaw(DOMAIN.ELECTION_MERKLE_NODE, current[i] + current[i + 1]));
        } else {
          // Odd node out: promoted unchanged, never hashed with itself.
          next.push(current[i]);
        }
      }

      levels.push(next);
    }

    return levels;
  }

  getRoot(): string {
    return this.levels[this.levels.length - 1][0];
  }

  getProof(index: number): MerkleProof {
    if (index < 0 || index >= this.leaves.length) {
      throw new Error(`Leaf index ${index} out of bounds (tree has ${this.leaves.length} leaves)`);
    }

    const siblings: MerkleSibling[] = [];
    let currentIndex = index;

    for (let level = 0; level < this.levels.length - 1; level++) {
      const currentLevel = this.levels[level];
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
      const hasSibling = siblingIndex < currentLevel.length;

      siblings.push({
        left: isRightNode,
        hash: hasSibling ? currentLevel[siblingIndex] : '',
        empty: !hasSibling,
      });

      currentIndex = Math.floor(currentIndex / 2);
    }

    return { root: this.getRoot(), leaf: this.leaves[index], index, siblings };
  }

  indexOfRawLeaf(raw: string): number {
    const hashed = domainHashRaw(DOMAIN.ELECTION_MERKLE_LEAF, raw);
    return this.leaves.indexOf(hashed);
  }
}

/**
 * Recompute a proof's root from its leaf and sibling path, independent of
 * any MerkleTree instance - this is what lets a receipt holder verify
 * inclusion from just the proof, without the full leaf set.
 */
export function recomputeMerkleRoot(proof: Pick<MerkleProof, 'leaf' | 'siblings'>): string {
  let hash = proof.leaf;
  for (const sibling of proof.siblings) {
    if (!sibling.empty) {
      hash = sibling.left
        ? domainHashRaw(DOMAIN.ELECTION_MERKLE_NODE, sibling.hash + hash)
        : domainHashRaw(DOMAIN.ELECTION_MERKLE_NODE, hash + sibling.hash);
    }
  }
  return hash;
}

export function hashLeaf(raw: string): string {
  return domainHashRaw(DOMAIN.ELECTION_MERKLE_LEAF, raw);
}
