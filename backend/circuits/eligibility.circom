pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

/**
 * ELIGIBILITY PROOF CIRCUIT
 * =========================
 * Proves membership of a secret credential in the election's eligibility
 * set (a Poseidon Merkle tree of enrolled voters' commitments) without
 * revealing which leaf, and outputs a nullifier that is deterministic per
 * (secret, electionId) so a double vote in the same election reuses the
 * same nullifier and gets rejected, while the same voter's nullifier in a
 * different election is unrelated (unlinkable across elections).
 *
 * PUBLIC INPUTS:
 * - merkleRoot: root of the election's current eligibility tree
 * - electionId: field-element encoding of the election (see canonical.ts
 *   fieldElement() for how the caller derives this from the UUID)
 *
 * PRIVATE INPUTS:
 * - secret, salt: the voter's credential (commitment = Poseidon(secret, salt))
 * - pathElements[levels]: sibling hashes on the path from leaf to root
 * - pathIndices[levels]: 0 = current node is left child, 1 = right child
 *
 * OUTPUTS:
 * - nullifier = Poseidon(secret, electionId)
 */
template MerkleTreeInclusion(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    component hashers[levels];
    component muxLeft[levels];
    component muxRight[levels];

    signal levelHash[levels + 1];
    levelHash[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // pathIndices[i] must be a bit
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        muxLeft[i] = Mux1();
        muxLeft[i].c[0] <== levelHash[i];
        muxLeft[i].c[1] <== pathElements[i];
        muxLeft[i].s <== pathIndices[i];

        muxRight[i] = Mux1();
        muxRight[i].c[0] <== pathElements[i];
        muxRight[i].c[1] <== levelHash[i];
        muxRight[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== muxLeft[i].out;
        hashers[i].inputs[1] <== muxRight[i].out;

        levelHash[i + 1] <== hashers[i].out;
    }

    root <== levelHash[levels];
}

template Eligibility(levels) {
    // PUBLIC INPUTS
    signal input merkleRoot;
    signal input electionId;

    // PRIVATE INPUTS (witness)
    signal input secret;
    signal input salt;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // OUTPUTS
    signal output nullifier;

    // Credential is non-zero (prevent trivial proofs)
    component isZero = IsZero();
    isZero.in <== secret;
    isZero.out === 0;

    // leaf = Poseidon(secret, salt) - matches computeEligibilityCommitment()
    component leafHasher = Poseidon(2);
    leafHasher.inputs[0] <== secret;
    leafHasher.inputs[1] <== salt;

    // Merkle membership: reconstructed root must match the public root
    component tree = MerkleTreeInclusion(levels);
    tree.leaf <== leafHasher.out;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }
    tree.root === merkleRoot;

    // nullifier binds the credential to this election only - unlinkable
    // across elections, deterministic (so double votes collide) within one
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== electionId;
    nullifier <== nullifierHasher.out;
}

component main {public [merkleRoot, electionId]} = Eligibility(20);
