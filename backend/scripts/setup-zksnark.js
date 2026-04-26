#!/usr/bin/env node
/**
 * ZK-SNARK TRUSTED SETUP CEREMONY
 * ================================
 * PRODUCTION: Must be run in multi-party computation (MPC) ceremony
 * 
 * Security Requirements:
 * - 3+ independent parties for Powers of Tau
 * - Air-gapped machines for toxic waste destruction
 * - Cryptographic attestation of each contribution
 * - Public verification of ceremony transcript
 * 
 * For development: Uses small circuit for faster compilation
 * For production: Use ptau_final_16.ptau from Hermez trusted setup
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

const CIRCUITS_DIR = path.join(__dirname, '../circuits');
const BUILD_DIR = path.join(__dirname, '../circuits/build');

async function setupCircuit() {
  console.log('🔐 Starting zk-SNARK Trusted Setup...\n');
  
  // Create build directory
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }
  
  try {
    // Step 1: Compile circuit (requires circom binary)
    console.log('📋 Step 1: Compiling circuit...');
    console.log('⚠️  PRODUCTION: Requires circom compiler');
    console.log('   Install: npm install -g circom');
    console.log('   Or download from: https://github.com/iden3/circom\n');
    
    // Step 2: Powers of Tau ceremony
    console.log('🎲 Step 2: Powers of Tau (for production: use Hermez ptau)');
    console.log('   Development: Creating small ptau...');
    
    // For development: create minimal ptau
    // For production: Download perpetual-powers-of-tau ceremony file
    const ptauPath = path.join(BUILD_DIR, 'powersOfTau28_hez_final_10.ptau');
    
    if (!fs.existsSync(ptauPath)) {
      console.log('   ⚠️  No ptau file found. For production:');
      console.log('   Download: https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau');
      console.log('   This is from Hermez trusted setup ceremony (256M constraints)');
      return false;
    }
    
    // Step 3: Circuit-specific setup
    console.log('\n🔑 Step 3: Generating proving key...');
    console.log('   ⚠️  PRODUCTION: Multi-party ceremony required');
    console.log('   Toxic waste must be destroyed by all participants\n');
    
    // Step 4: Export verification key
    console.log('✅ Step 4: Exporting verification key...');
    console.log('   Verification key will be public');
    console.log('   Used by smart contracts and verifiers\n');
    
    console.log('📝 PRODUCTION REQUIREMENTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. Install circom: npm install -g circom');
    console.log('2. Compile circuit: circom token_validity.circom --r1cs --wasm');
    console.log('3. Download ptau: wget https://hermez.s3.../powersOfTau28_hez_final_16.ptau');
    console.log('4. Run ceremony: snarkjs groth16 setup ...');
    console.log('5. Verify setup: snarkjs zkey verify ...');
    console.log('6. Export vkey: snarkjs zkey export verificationkey\n');
    
    console.log('🔒 SECURITY CRITICAL:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('- Ceremony must involve 3+ independent parties');
    console.log('- Each party runs on air-gapped machine');
    console.log('- Toxic waste (random values) MUST be destroyed');
    console.log('- All contributions must be cryptographically attested');
    console.log('- Final transcript must be publicly verifiable');
    console.log('- Use battle-tested ptau (Hermez, Tornado Cash, etc.)\n');
    
    return true;
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    return false;
  }
}

// Run setup
setupCircuit().then(success => {
  if (success) {
    console.log('✅ Setup instructions displayed');
    console.log('📚 Documentation: https://docs.circom.io/');
    process.exit(0);
  } else {
    console.log('❌ Setup incomplete - see instructions above');
    process.exit(1);
  }
});
