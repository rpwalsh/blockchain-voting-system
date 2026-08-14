/**
 * Ballot submission protocol - see docs/protocol.md.
 *
 * Real, enforced HTTP flow for voter registration, challenge issuance, and
 * ballot casting, with real nullifier-based replay protection via the
 * token_validity Groth16 circuit.
 *
 * Honest scope note (see docs/cryptography.md): `candidateId` is still
 * accepted and stored in the clear on the Vote row, matching how tallying
 * currently works. This endpoint does not yet achieve full ballot secrecy
 * from the server's own database - that requires the real cryptographic
 * tally (Milestone 3), not just an enforced submission endpoint. What this
 * endpoint *does* provide for real: proof-gated, replay-protected,
 * one-vote-per-credential ballot acceptance, appended to a signed,
 * hash-chained ledger and a domain-separated Merkle tree.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import crypto, { MerkleTree } from '../crypto/engine';
import { domainHash, domainHashRaw, DOMAIN } from '../crypto/canonical';
import { createLedgerEntry } from '../utils/audit';

const router = Router();

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * POST /api/elections/:electionId/voters/register
 * Registers a member of the election's electorate snapshot as a voter.
 *
 * Real for what it does: checks snapshot membership, enforces one
 * registration per (electionId, identityHash), issues a real random
 * token, stores its real Poseidon commitment (what the ZK proof at vote
 * time is checked against) and a signed registration attestation.
 *
 * Honest scope note: this is still a server-issued bearer credential the
 * server can trace back to `externalId` - not yet the anonymous,
 * unlinkable credential design in docs/protocol.md's "Credential issuance"
 * stage (Milestone 2). The private signing key returned here is generated
 * server-side and returned to the caller once; it is not persisted.
 */
router.post('/:electionId/voters/register', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const { externalId } = req.body || {};

    if (!externalId || typeof externalId !== 'string') {
      return res.status(400).json({ success: false, error: 'externalId required' });
    }

    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, error: 'Election not found' });
    if (!['DRAFT', 'REGISTRATION', 'VOTING'].includes(election.status)) {
      return res.status(409).json({ success: false, error: `Election status ${election.status} does not accept registration` });
    }
    if (!election.signingPrivateKey || !election.signingPublicKey) {
      return res.status(500).json({ success: false, error: 'Election has no signing keypair configured' });
    }

    const snapshot = await prisma.electorateSnapshot.findUnique({ where: { electionId } });
    if (!snapshot) {
      return res.status(409).json({ success: false, error: 'No electorate snapshot exists for this election' });
    }
    const member = await prisma.member.findFirst({
      where: { organizationId: election.organizationId, externalId },
    });
    const isEligible = member
      ? await prisma.snapshotMember.findUnique({
          where: { snapshotId_memberId: { snapshotId: snapshot.id, memberId: member.id } },
        })
      : null;
    if (!member || !isEligible) {
      return res.status(403).json({ success: false, error: 'externalId is not in this election\'s electorate snapshot' });
    }

    const identityHash = crypto.createIdentityHash(externalId, electionId);
    const existing = await prisma.voter.findUnique({
      where: { electionId_identityHash: { electionId, identityHash } },
    });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Already registered for this election' });
    }

    const token = crypto.generateVotingToken();
    const votingTokenHash = crypto.hashVotingToken(token);
    const tokenCommitment = await crypto.computeTokenCommitment(token);
    const voterKeyPair = crypto.generateKeyPair();

    const registrationProof = crypto.signData(
      domainHash(DOMAIN.ELECTION_CREDENTIAL, { electionId, externalId, votingTokenHash, tokenCommitment }),
      election.signingPrivateKey
    );

    await prisma.voter.create({
      data: {
        electionId,
        identityHash,
        votingTokenHash,
        tokenCommitment,
        publicKey: voterKeyPair.publicKey,
        registrationProof,
      },
    });

    await createLedgerEntry(electionId, 'REGISTRATION', { votingTokenHash }, election.signingPrivateKey);

    return res.status(201).json({
      success: true,
      votingToken: token, // returned once - the server does not persist the plaintext token
      voterPrivateKey: voterKeyPair.privateKey, // returned once - not persisted server-side
      message: 'Store votingToken securely - it is required to cast a ballot and cannot be recovered from the server.',
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/elections/:electionId/challenge
 * Issues a fresh, single-use freshness challenge. A token-validity proof
 * submitted with POST /vote must be bound to a challenge issued here and
 * not previously consumed - this is what makes the proof's freshness
 * binding an actually-enforced anti-replay mechanism rather than a
 * self-reported claim.
 */
router.get('/:electionId/challenge', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, error: 'Election not found' });

    const challenge = crypto.generateChallenge();
    await prisma.challengeNonce.create({
      data: {
        electionId,
        challenge,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    return res.json({ success: true, challenge, expiresInMs: CHALLENGE_TTL_MS });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/elections/:electionId/vote
 * Cast a ballot. See docs/protocol.md, "Stage: Ballot submission" for the
 * full spec this implements, and the file-level comment above for what's
 * real vs. not yet (candidateId is still visible to the server).
 */
router.post('/:electionId/vote', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const { votingToken, candidateId, challenge, tokenValidityProof } = req.body || {};

    if (!votingToken || !candidateId || !challenge || !tokenValidityProof) {
      return res.status(400).json({
        success: false,
        error: 'votingToken, candidateId, challenge, and tokenValidityProof are required',
      });
    }

    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ success: false, error: 'Election not found' });
    if (election.status !== 'VOTING') {
      return res.status(409).json({ success: false, error: `Election is not open for voting (status: ${election.status})` });
    }
    if (!election.signingPrivateKey) {
      return res.status(500).json({ success: false, error: 'Election has no signing keypair configured' });
    }

    const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, electionId } });
    if (!candidate) {
      return res.status(400).json({ success: false, error: 'candidateId is not a valid candidate for this election' });
    }

    // Challenge must have been issued by this server for this election and
    // not already consumed - the core of real (not just claimed) replay
    // protection.
    const nonce = await prisma.challengeNonce.findUnique({ where: { challenge } });
    if (!nonce || nonce.electionId !== electionId) {
      return res.status(400).json({ success: false, error: 'Unknown challenge' });
    }
    if (nonce.consumedAt) {
      return res.status(409).json({ success: false, error: 'Challenge already used' });
    }
    if (nonce.expiresAt < new Date()) {
      return res.status(400).json({ success: false, error: 'Challenge expired' });
    }

    const votingTokenHash = crypto.hashVotingToken(votingToken);
    const voter = await prisma.voter.findUnique({ where: { votingTokenHash } });
    if (!voter || voter.electionId !== electionId) {
      return res.status(403).json({ success: false, error: 'Unknown voting token for this election' });
    }
    if (voter.hasVoted) {
      return res.status(409).json({ success: false, error: 'This credential has already voted' });
    }
    if (!voter.tokenCommitment) {
      return res.status(500).json({ success: false, error: 'Voter record missing token commitment' });
    }

    // Real Groth16 verification: proves the caller knows a token matching
    // the commitment on file, bound to this specific (unconsumed) challenge.
    const proofValid = await crypto.verifyTokenValidityProof(tokenValidityProof, voter.tokenCommitment, challenge);
    if (!proofValid) {
      return res.status(403).json({ success: false, error: 'Token validity proof did not verify' });
    }

    // Consume the challenge before doing anything else - a failure past
    // this point must not leave a reusable challenge behind.
    await prisma.challengeNonce.update({ where: { challenge }, data: { consumedAt: new Date() } });

    const encryptedVote = crypto.encryptVote(candidateId, election.publicKey);
    const voteValidityProofJson = await crypto.generateVoteValidityProof(
      encryptedVote,
      (await prisma.candidate.findMany({ where: { electionId }, select: { id: true } })).map(c => c.id)
    );

    const receiptHash = crypto.createReceiptHash(JSON.stringify({ electionId, votingTokenHash, timestamp: Date.now() }));
    const ledgerEntryHash = domainHashRaw(DOMAIN.ELECTION_BALLOT, receiptHash + ':' + votingTokenHash);

    const result = await prisma.$transaction(async tx => {
      const updated = await tx.voter.updateMany({
        where: { id: voter.id, hasVoted: false },
        data: { hasVoted: true, votedAt: new Date(), voteReceiptHash: receiptHash },
      });
      if (updated.count === 0) {
        // Lost a race with another concurrent vote using the same credential.
        throw new Error('DOUBLE_VOTE_RACE');
      }

      const existingVotes = await tx.vote.findMany({
        where: { electionId },
        orderBy: { ledgerTimestamp: 'asc' },
        select: { encryptedVote: true },
      });
      const allCiphertexts = [...existingVotes.map(v => v.encryptedVote), JSON.stringify(encryptedVote)];
      const tree = new MerkleTree(allCiphertexts);
      const newRoot = tree.getRoot();
      const proof = tree.getProof(allCiphertexts.length - 1);

      const vote = await tx.vote.create({
        data: {
          electionId,
          candidateId,
          encryptedVote: JSON.stringify(encryptedVote),
          votingTokenHash,
          voteProof: voteValidityProofJson,
          receiptHash,
          ledgerEntryHash,
          merkleRoot: newRoot,
          merkleProof: JSON.stringify(proof),
        },
      });

      await tx.election.update({ where: { id: electionId }, data: { merkleRoot: newRoot, lastMerkleUpdate: new Date(), voteCount: { increment: 1 } } });

      return { vote, merkleRoot: newRoot, merkleProof: proof };
    });

    await createLedgerEntry(
      electionId,
      'VOTE_CAST',
      { ledgerEntryHash, receiptHash: result.vote.receiptHash, merkleRoot: result.merkleRoot },
      election.signingPrivateKey
    );

    return res.status(201).json({
      success: true,
      receipt: {
        protocolVersion: 'GOVERNANCE-BALLOT-1',
        electionId,
        receiptHash: result.vote.receiptHash,
        merkleRoot: result.merkleRoot,
      },
    });
  } catch (error: any) {
    if (error.message === 'DOUBLE_VOTE_RACE') {
      return res.status(409).json({ success: false, error: 'This credential has already voted' });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
