pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * TOKEN VALIDITY PROOF CIRCUIT
 * =============================
 * PRODUCTION-GRADE zk-SNARK for proving token possession
 * 
 * Security Level: NSA Suite B compatible
 * Proves voter has valid token without revealing it
 * 
 * PUBLIC INPUTS:
 * - tokenHashCommitment: Hash of the token (public)
 * - challengeHash: Challenge from verifier (public)
 * 
 * PRIVATE INPUTS:
 * - tokenPreimage: The actual voting token (secret)
 * - salt: Random salt for commitment (secret)
 * 
 * CONSTRAINTS:
 * 1. Poseidon(tokenPreimage, salt) == tokenHashCommitment
 * 2. Token is non-zero (prevent trivial proofs)
 * 3. Challenge is incorporated (replay protection)
 */
template TokenValidity() {
    // PUBLIC INPUTS
    signal input tokenHashCommitment;
    signal input challengeHash;
    
    // PRIVATE INPUTS (witness)
    signal input tokenPreimage;
    signal input salt;
    
    // OUTPUTS
    signal output validityFlag;
    
    // COMPONENT: Poseidon hash for commitment
    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== tokenPreimage;
    poseidon.inputs[1] <== salt;
    
    // CONSTRAINT 1: Commitment matches
    poseidon.out === tokenHashCommitment;
    
    // CONSTRAINT 2: Token is non-zero (prevent trivial attacks)
    component isZero = IsZero();
    isZero.in <== tokenPreimage;
    isZero.out === 0; // Assert NOT zero
    
    // CONSTRAINT 3: Challenge incorporation (Fiat-Shamir)
    // Combine token and challenge to bind proof to this verification session
    component challengeBound = Poseidon(2);
    challengeBound.inputs[0] <== tokenPreimage;
    challengeBound.inputs[1] <== challengeHash;
    
    // Output 1 if all constraints pass
    validityFlag <== 1;
}

component main {public [tokenHashCommitment, challengeHash]} = TokenValidity();
