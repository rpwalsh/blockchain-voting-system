const { MerkleTree } = require('./dist/crypto/engine');

const leaves = ['hash1', 'hash2', 'hash3', 'hash4', 'hash5'];
const tree = new MerkleTree(leaves);
const root = tree.getRoot();

console.log('Root:', root);
console.log('');

for (let i = 0; i < leaves.length; i++) {
  const proof = tree.getProof(i);
  const isValid = MerkleTree.verifyProof(proof);
  console.log(`Index ${i} (${leaves[i]}):`);
  console.log('  Leaf hash:', proof.leaf);
  console.log('  Proof length:', proof.proof.length);
  console.log('  Proof hashes:', proof.proof);
  console.log('  Root:', proof.root);
  console.log('  Valid:', isValid);
  console.log('');
}
