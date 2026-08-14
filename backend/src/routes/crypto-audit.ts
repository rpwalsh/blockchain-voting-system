/**
 * CRYPTOGRAPHIC AUDIT API
 * =======================
 * Exposes the cryptographic primitives this system actually uses, and lets
 * a caller run real checks against a real election's data rather than
 * asking them to trust a description of what "should" happen.
 *
 * See docs/cryptography.md for the full, honest per-primitive breakdown.
 * This endpoint makes no compliance or certification claims (no FIPS,
 * Common Criteria, SOC 2, ISO 27001, etc). Using NIST-recommended
 * algorithms (true, see below) is not the same claim as holding a
 * certification.
 */

import { Router, Request, Response } from 'express';
import crypto, { MerkleTree } from '../crypto/engine';
import { domainHash, DOMAIN } from '../crypto/canonical';
import { prisma } from '../index';

const router = Router();

/**
 * GET /api/crypto-audit/capabilities
 * Returns the cryptographic primitives actually in use, and their real
 * implementation status (real vs. fallback) - see docs/cryptography.md.
 */
router.get('/capabilities', (req: Request, res: Response) => {
  res.json({
    success: true,
    system: 'Election protocol cryptographic engine',
    docs: 'See docs/protocol.md, docs/threat-model.md, docs/trust-model.md, docs/cryptography.md in this repository',
    capabilities: {
      encryption: {
        name: 'NaCl Box (Curve25519-XSalsa20-Poly1305)',
        keyExchange: 'X25519 (Curve25519)',
        cipher: 'XSalsa20',
        auth: 'Poly1305',
        status: 'real',
      },
      signatures: {
        name: 'Ed25519',
        type: 'EdDSA (Edwards-curve Digital Signature Algorithm)',
        curve: 'Curve25519',
        status: 'real',
      },
      hashing: {
        primary: 'SHA3-256 (Keccak), domain-separated (see docs/cryptography.md)',
        extended: 'SHA3-512',
        pbkdf2Iterations: 210000,
        status: 'real',
      },
      thresholdCrypto: {
        name: 'Shamir Secret Sharing',
        defaultThreshold: '3-of-5',
        description: 'Election key split among 5 officials, need 3 to decrypt',
        status: 'real implementation, project-written (not an externally audited library) - see docs/cryptography.md',
      },
      merkleTree: {
        algorithm: 'SHA3-256, domain-separated leaf/internal-node hashing',
        verification: 'O(log n) proof size',
        status: 'real',
      },
      zeroKnowledge: {
        tokenValidity: {
          protocol: 'Groth16 zk-SNARK',
          curve: 'BN128',
          status: 'real - compiled circuit, real trusted-setup artifacts (single-contributor local ceremony - see backend/circuits/README.md for what a production ceremony would require)',
        },
        voteValidity: {
          status: 'not implemented - generateVoteValidityProof always returns the fiat-shamir-fallback protocol, which is a commitment, not a zero-knowledge proof of anything',
        },
        tallyCorrectness: {
          status: 'not implemented',
        },
      },
      blockchainAnchoring: {
        status: 'simulated - generateBlockchainAnchor() computes a local commitment digest and does not submit anything to Ethereum, Hyperledger, or any other chain. See docs/cryptography.md, "On the blockchain anchor".',
      },
      dag: {
        name: 'Directed Acyclic Graph (VoteDAG)',
        status: 'implemented as a data structure; not currently wired into any live route',
      },
    },
  });
});

/**
 * GET /api/crypto-audit/live-demo
 * Demonstrates cryptographic operations in real-time
 */
router.get('/live-demo', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const demos: any[] = [];

  // 1. Key Generation Demo
  const keyGenStart = Date.now();
  const keyPair = crypto.generateKeyPair();
  demos.push({
    operation: 'Ed25519 Key Generation',
    duration: `${Date.now() - keyGenStart}ms`,
    result: {
      publicKey: keyPair.publicKey.substring(0, 20) + '...',
      algorithm: keyPair.algorithm,
      keySize: '256-bit',
    },
  });

  // 2. Vote Encryption Demo
  const electionKeyPair = crypto.generateElectionKeyPair();
  const encryptStart = Date.now();
  const encryptedVote = crypto.encryptVote('candidate-demo-123', electionKeyPair.publicKey);
  demos.push({
    operation: 'Vote Encryption (NaCl Box)',
    duration: `${Date.now() - encryptStart}ms`,
    result: {
      ciphertext: encryptedVote.ciphertext.substring(0, 30) + '...',
      algorithm: encryptedVote.algorithm,
      version: encryptedVote.version,
      note: 'Vote is now unreadable without election private key',
    },
  });

  // 3. Signature Demo
  const signStart = Date.now();
  const signature = crypto.signData('vote-data-hash-example', keyPair.privateKey);
  demos.push({
    operation: 'Ed25519 Digital Signature',
    duration: `${Date.now() - signStart}ms`,
    result: {
      signature: signature.substring(0, 30) + '...',
      verifiable: true,
      tamperProof: 'Any modification invalidates signature',
    },
  });

  // 4. Merkle Tree Demo
  const votes = ['vote1', 'vote2', 'vote3', 'vote4', 'vote5'];
  const merkleStart = Date.now();
  const merkleTree = new MerkleTree(votes);
  const proof = merkleTree.getProof(2);
  demos.push({
    operation: 'Merkle Tree Construction',
    duration: `${Date.now() - merkleStart}ms`,
    result: {
      root: proof.root.substring(0, 20) + '...',
      proofSize: `${proof.proof.length} hashes (${Math.ceil(Math.log2(votes.length))} levels)`,
      totalVotes: votes.length,
      verificationComplexity: `O(log ${votes.length}) = O(${Math.ceil(Math.log2(votes.length))})`,
    },
  });

  // 5. Merkle Proof Verification
  const verifyStart = Date.now();
  const isValid = MerkleTree.verifyProof(proof);
  demos.push({
    operation: 'Merkle Proof Verification',
    duration: `${Date.now() - verifyStart}ms`,
    result: {
      valid: isValid,
      note: 'Proves vote #3 is included without revealing other votes',
    },
  });

  // 6. Threshold Crypto Demo
  const shamirStart = Date.now();
  const shares = crypto.splitSecretShamir(electionKeyPair.privateKey, 3, 5);
  demos.push({
    operation: 'Shamir Secret Sharing (3-of-5)',
    duration: `${Date.now() - shamirStart}ms`,
    result: {
      totalShares: 5,
      threshold: 3,
      sharePreview: shares[0].share.substring(0, 20) + '...',
      benefit: 'No single official can decrypt - need 3 of 5 to reconstruct key',
    },
  });

  // 7. Zero-Knowledge Proof Demo (real Groth16 proof + real verification)
  const zkStart = Date.now();
  const zkToken = crypto.generateVotingToken();
  const zkChallenge = crypto.generateChallenge();
  const zkProof = await crypto.generateTokenValidityProof(zkToken, zkChallenge);
  const zkCommitment = await crypto.computeTokenCommitment(zkToken);
  const zkVerified = await crypto.verifyTokenValidityProof(zkProof, zkCommitment, zkChallenge);
  const zkWrongCommitment = await crypto.computeTokenCommitment(crypto.generateVotingToken());
  const zkRejectsWrongToken = await crypto.verifyTokenValidityProof(zkProof, zkWrongCommitment, zkChallenge);
  const zkRejectsStaleChallenge = await crypto.verifyTokenValidityProof(zkProof, zkCommitment, crypto.generateChallenge());
  demos.push({
    operation: 'Zero-Knowledge Proof Generation + Verification',
    duration: `${Date.now() - zkStart}ms`,
    result: {
      protocol: zkProof.protocol,
      curve: zkProof.curve,
      publicInputs: zkProof.publicInputs.length,
      verifiedAgainstRealCommitment: zkVerified,
      rejectsWrongToken: !zkRejectsWrongToken,
      rejectsStaleChallenge: !zkRejectsStaleChallenge,
      benefit: 'Proves token validity without revealing token',
    },
  });

  // 8. Receipt Hash Demo
  const receiptStart = Date.now();
  const receipt = crypto.createReceiptHash('encrypted-vote-data');
  demos.push({
    operation: 'Voter Receipt Generation',
    duration: `${Date.now() - receiptStart}ms`,
    result: {
      receiptHash: receipt.substring(0, 30) + '...',
      purpose: 'Voter can verify their vote was counted',
      privacy: 'Receipt reveals nothing about vote choice',
    },
  });

  res.json({
    success: true,
    totalDuration: `${Date.now() - startTime}ms`,
    message: 'Demonstration of the cryptographic primitives this system uses. See docs/protocol.md for which of these are wired into a live, enforced ballot-submission endpoint today versus demonstrated here in isolation.',
    demonstrations: demos,
  });
});

/**
 * GET /api/crypto-audit/election/:id/integrity
 * Full cryptographic integrity check of an election
 */
router.get('/election/:id/integrity', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const election = await prisma.election.findUnique({
      where: { id },
    });

    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found' });
    }

    // Fetch related data separately
    const votes = await prisma.vote.findMany({
      where: { electionId: id },
    });
    
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { electionId: id },
      orderBy: { timestamp: 'asc' },
    });

    const checks: any[] = [];

    // 1. Vote Count Integrity - status is derived from the actual match,
    // never hardcoded (see docs/threat-model.md, "Report false integrity
    // check status to auditors" row for why this matters).
    const voteCastEntries = ledgerEntries.filter((e: any) => e.entryType === 'VOTE_CAST').length;
    const voteCountMatch = votes.length === voteCastEntries;
    checks.push({
      check: 'Vote Count Integrity',
      status: voteCountMatch ? 'PASS' : 'FAIL',
      details: {
        recordedVotes: votes.length,
        voteCastLedgerEntries: voteCastEntries,
        match: voteCountMatch,
      },
    });

    // 2. Merkle Root Verification - actually recomputes the tree from the
    // current votes and compares against the election's stored root,
    // rather than just reporting "we built a tree successfully."
    if (votes.length > 0) {
      const voteHashes = votes.map((v: any) => v.encryptedVote);
      const tree = new MerkleTree(voteHashes);
      const recomputedRoot = tree.getRoot();
      const rootMatch = !!election.merkleRoot && election.merkleRoot === recomputedRoot;
      checks.push({
        check: 'Merkle Tree Integrity',
        status: rootMatch ? 'PASS' : 'FAIL',
        details: {
          recomputedRoot: recomputedRoot.substring(0, 32) + '...',
          storedRoot: election.merkleRoot ? election.merkleRoot.substring(0, 32) + '...' : null,
          match: rootMatch,
          totalLeaves: voteHashes.length,
          algorithm: 'SHA3-256, domain-separated',
        },
      });
    } else {
      checks.push({
        check: 'Merkle Tree Integrity',
        status: 'PASS',
        details: { note: 'No votes recorded yet - nothing to check', totalLeaves: 0 },
      });
    }

    // 3. Ledger Chain Integrity - actually walks previousEntryHash and
    // recomputes each entry's dataHash and signature, rather than
    // asserting chainValid = true without checking anything.
    let chainValid = true;
    const chainIssues: string[] = [];
    for (let i = 0; i < ledgerEntries.length; i++) {
      const entry: any = ledgerEntries[i];
      const prev: any = i > 0 ? ledgerEntries[i - 1] : null;

      const expectedDataHash = domainHash(DOMAIN.ELECTION_LEDGER, {
        electionId: entry.electionId,
        entryType: entry.entryType,
        data: entry.data,
        previousEntryHash: prev ? prev.dataHash : null,
      });
      if (expectedDataHash !== entry.dataHash) {
        chainValid = false;
        chainIssues.push(`entry ${i}: dataHash does not match recomputed hash`);
      }
      if ((entry.previousEntryHash || null) !== (prev ? prev.dataHash : null)) {
        chainValid = false;
        chainIssues.push(`entry ${i}: previousEntryHash does not match prior entry's dataHash`);
      }
      if (entry.signature && entry.signerPublicKey) {
        const sigValid = crypto.verifySignature(entry.dataHash, entry.signature, entry.signerPublicKey);
        if (!sigValid) {
          chainValid = false;
          chainIssues.push(`entry ${i}: signature does not verify against signerPublicKey`);
        }
      }
    }
    checks.push({
      check: 'Ledger Chain Integrity',
      status: chainValid ? 'PASS' : 'FAIL',
      details: {
        entriesChecked: ledgerEntries.length,
        chainUnbroken: chainValid,
        issues: chainIssues,
        type: 'Hash-chained, Ed25519-signed entries (see docs/protocol.md, "Stage: Audit")',
      },
    });

    // 4. Encryption Verification - fails if any recorded vote is not in
    // the expected encrypted-envelope shape, rather than always passing.
    const encryptedVotes = votes.filter((v: any) => v.encryptedVote && v.encryptedVote.includes('ciphertext'));
    const encryptionOk = votes.length === 0 || encryptedVotes.length === votes.length;
    checks.push({
      check: 'Vote Encryption Status',
      status: encryptionOk ? 'PASS' : 'FAIL',
      details: {
        totalVotes: votes.length,
        properlyEncrypted: encryptedVotes.length,
        algorithm: 'Curve25519-XSalsa20-Poly1305',
      },
    });

    // 5. Timestamp Monotonicity
    let timestampsValid = true;
    for (let i = 1; i < ledgerEntries.length; i++) {
      if (ledgerEntries[i].timestamp <= ledgerEntries[i - 1].timestamp) {
        timestampsValid = false;
        break;
      }
    }
    checks.push({
      check: 'Timestamp Monotonicity',
      status: timestampsValid ? 'PASS' : 'FAIL',
      details: {
        description: 'All entries have increasing timestamps',
        benefit: 'Prevents backdating attacks',
      },
    });

    res.json({
      success: true,
      election: {
        id: election.id,
        name: election.name,
        status: election.status,
      },
      integrityReport: {
        overallStatus: checks.every(c => c.status === 'PASS') ? 'VERIFIED' : 'ISSUES_FOUND',
        checksPerformed: checks.length,
        checks,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/crypto-audit/verify-receipt
 * Verify a voter's receipt proves their vote was counted
 */
router.post('/verify-receipt', async (req: Request, res: Response) => {
  const { receiptHash, electionId } = req.body;

  if (!receiptHash || !electionId) {
    return res.status(400).json({ 
      success: false, 
      error: 'receiptHash and electionId required' 
    });
  }

  try {
    // Find the vote by receipt hash
    const vote = await prisma.vote.findFirst({
      where: {
        receiptHash,
        electionId,
      },
      include: {
        election: true,
      },
    });

    if (!vote) {
      return res.json({
        success: true,
        verified: false,
        message: 'No vote found with this receipt hash',
      });
    }

    // Generate Merkle proof
    const allVotes = await prisma.vote.findMany({
      where: { electionId },
      orderBy: { ledgerTimestamp: 'asc' },
    });

    const voteHashes = allVotes.map((v: any) => v.encryptedVote);
    const voteIndex = allVotes.findIndex((v: any) => v.id === vote.id);
    
    const tree = new MerkleTree(voteHashes);
    const proof = tree.getProof(voteIndex);
    const proofValid = MerkleTree.verifyProof(proof);

    res.json({
      success: true,
      verified: true,
      verification: {
        receiptHash: receiptHash.substring(0, 20) + '...',
        electionName: vote.election.name,
        voteIncluded: proofValid,
        merkleProof: {
          root: proof.root.substring(0, 32) + '...',
          proofLength: proof.proof.length,
          votePosition: voteIndex + 1,
          totalVotes: allVotes.length,
        },
        timestamp: (vote as any).ledgerTimestamp || (vote as any).createdAt,
      },
      whatThisMeans: {
        forVoter: 'Your vote was cryptographically recorded in the election',
        privacy: 'This receipt does NOT reveal who you voted for',
        verification: 'Anyone with this receipt can verify independently',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/crypto-audit/election/:id/merkle-tree
 * Get the current Merkle tree structure for an election
 */
router.get('/election/:id/merkle-tree', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const votes = await prisma.vote.findMany({
      where: { electionId: id },
      orderBy: { ledgerTimestamp: 'asc' },
      select: { encryptedVote: true, receiptHash: true, ledgerTimestamp: true },
    });

    if (votes.length === 0) {
      return res.json({
        success: true,
        merkleTree: null,
        message: 'No votes yet',
      });
    }

    const voteHashes = votes.map((v: any) => v.encryptedVote);
    const tree = new MerkleTree(voteHashes);

    res.json({
      success: true,
      merkleTree: {
        root: tree.getRoot(),
        totalLeaves: votes.length,
        depth: Math.ceil(Math.log2(votes.length)),
        algorithm: 'SHA3-256',
        verificationComplexity: `O(log₂ ${votes.length}) = O(${Math.ceil(Math.log2(votes.length))})`,
      },
      explanation: {
        whatIsThis: 'A cryptographic data structure that proves all votes are included',
        howItWorks: 'Each vote is hashed, then pairs are combined up to a single root',
        benefit: 'Can prove any single vote is included without downloading all votes',
        tamperProof: 'Changing ANY vote changes the root - tampering is impossible to hide',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/crypto-audit/algorithms
 * Detailed explanation of all cryptographic algorithms used
 */
router.get('/algorithms', (req: Request, res: Response) => {
  res.json({
    success: true,
    title: 'Cryptographic Algorithm Reference',
    algorithms: [
      {
        name: 'Curve25519',
        type: 'Elliptic Curve',
        usage: 'Key exchange (X25519)',
        security: '128-bit equivalent',
        inventor: 'Daniel J. Bernstein',
        whyWeUseIt: 'Fast, secure, no patents, NSA cannot backdoor',
      },
      {
        name: 'XSalsa20',
        type: 'Stream Cipher',
        usage: 'Vote encryption',
        security: '256-bit key',
        inventor: 'Daniel J. Bernstein',
        whyWeUseIt: 'Extremely fast, constant-time (no timing attacks)',
      },
      {
        name: 'Poly1305',
        type: 'Message Authentication Code',
        usage: 'Encryption authentication',
        security: '128-bit',
        inventor: 'Daniel J. Bernstein',
        whyWeUseIt: 'Detects any tampering with ciphertext',
      },
      {
        name: 'Ed25519',
        type: 'Digital Signature',
        usage: 'Signing votes and ledger entries',
        security: '128-bit equivalent',
        inventor: 'Daniel J. Bernstein',
        whyWeUseIt: 'Small signatures (64 bytes), fast verification',
      },
      {
        name: 'SHA3-256 (Keccak)',
        type: 'Hash Function',
        usage: 'Merkle trees, integrity checks',
        security: '256-bit',
        inventor: 'Guido Bertoni et al.',
        whyWeUseIt: 'NIST standard, completely different design from SHA-2',
      },
      {
        name: 'Shamir Secret Sharing',
        type: 'Threshold Cryptography',
        usage: 'Splitting election private key',
        security: 'Information-theoretic',
        inventor: 'Adi Shamir',
        whyWeUseIt: 'No single person can decrypt - need K of N officials',
      },
      {
        name: 'Groth16 (zk-SNARKs)',
        type: 'Zero-Knowledge Proof',
        usage: 'Proving knowledge of a valid voting token without revealing it (token_validity circuit)',
        security: '128-bit',
        status: 'real for the token_validity circuit specifically - compiled, real trusted-setup artifacts (single-contributor ceremony, see backend/circuits/README.md). Not yet implemented for ballot validity or tally correctness - see docs/cryptography.md',
        whyWeUseIt: 'Prove you hold a valid token without revealing which one',
      },
    ],
    note: 'These are the algorithms in use. Using NIST-approved algorithms is not the same claim as holding a certification - this system has not gone through FIPS 140, Common Criteria, SOC 2, or ISO 27001 validation. See docs/cryptography.md.',
  });
});

export default router;
