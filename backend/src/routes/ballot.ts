/**
 * Ballot submission protocol - see docs/protocol.md.
 *
 * Registration (identified, via externalId) issues a token used only to
 * authenticate eligibility-commitment enrollment (routes/eligibility.ts) -
 * not to vote directly. Voting itself uses an anonymous eligibility proof
 * (circuits/eligibility.circom): the server verifies Merkle membership and
 * checks the proof's nullifier hasn't been spent, without ever learning
 * which enrolled voter this is.
 *
 * The GET /challenge endpoint and token_validity-based proof are no longer
 * part of the voting path (they authenticated a *specific* voter, which is
 * exactly the anonymity property Milestone 2 exists to remove) - left in
 * place as still-real, still-tested infrastructure rather than deleted.
 *
 * Honest scope note (see docs/cryptography.md): `candidateId` is still
 * accepted and stored in the clear on the Vote row, matching how tallying
 * currently works. This endpoint does not yet achieve full ballot secrecy
 * from the server's own database - that requires the real cryptographic
 * tally (Milestone 3), not just an enforced submission endpoint. What this
 * endpoint *does* provide for real: proof-gated, replay-protected,
 * one-vote-per-credential, anonymous ballot acceptance, appended to a
 * signed, hash-chained ledger and a domain-separated Merkle tree.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import crypto, { MerkleTree } from '../crypto/engine';
import { domainHash, domainHashRaw, DOMAIN } from '../crypto/canonical';
import { createLedgerEntry } from '../utils/audit';
import tallyLib from '../crypto/tally';

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
 * Cast a ballot using an anonymous eligibility proof (see
 * circuits/eligibility.circom, routes/eligibility.ts) rather than a
 * per-voter token proof - the server verifies membership in the
 * eligibility set and checks the proof's nullifier hasn't been spent,
 * without ever looking up which enrolled voter this is. This closes the
 * anonymity gap the old token-based flow had: that flow looked up "voter
 * by token hash" *before* verifying anything, so the server always knew
 * who was voting regardless of the proof.
 *
 * Honest scope note (see docs/cryptography.md): `candidateId` is still
 * accepted and stored in the clear on the Vote row pending Milestone 3's
 * homomorphic tally.
 */
router.post('/:electionId/vote', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const { candidateId, eligibilityProof } = req.body || {};

    if (!candidateId || !eligibilityProof) {
      return res.status(400).json({
        success: false,
        error: 'candidateId and eligibilityProof are required',
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
    if (!election.eligibilityRoot) {
      return res.status(500).json({ success: false, error: 'Election has no eligibility root configured' });
    }

    const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, electionId } });
    if (!candidate) {
      return res.status(400).json({ success: false, error: 'candidateId is not a valid candidate for this election' });
    }

    // Real Groth16 verification: proves the caller knows a credential that
    // is a member of the eligibility tree at election.eligibilityRoot,
    // without revealing which leaf. Returns the proof's nullifier only if
    // the proof actually verifies.
    const nullifier = await crypto.verifyEligibilityProof(eligibilityProof, election.eligibilityRoot, electionId);
    if (!nullifier) {
      return res.status(403).json({ success: false, error: 'Eligibility proof did not verify' });
    }

    const orderedCandidates = await prisma.candidate.findMany({ where: { electionId }, orderBy: { order: 'asc' }, select: { id: true } });
    const encryptedVote = crypto.encryptVote(candidateId, election.publicKey);
    const voteValidityProofJson = await crypto.generateVoteValidityProof(
      encryptedVote,
      orderedCandidates.map(c => c.id)
    );

    // Homomorphic tally ciphertext (Milestone 3, see crypto/tally.ts) - one
    // EC ElGamal encryption of 0/1 per candidate, one-hot at this voter's
    // choice, summed and threshold-decrypted at tally time without any
    // ballot ever being individually decrypted. Only populated once the
    // election has a tally keypair configured.
    let tallyCiphertextsJson: string | null = null;
    if (election.tallyPublicKey) {
      const choiceIndex = orderedCandidates.findIndex(c => c.id === candidateId);
      const tallyPublicKey = JSON.parse(election.tallyPublicKey);
      const oneHot = tallyLib.encryptOneHot(choiceIndex, orderedCandidates.length, tallyPublicKey);
      tallyCiphertextsJson = JSON.stringify(
        orderedCandidates.map((c, i) => ({ candidateId: c.id, ciphertext: oneHot[i] }))
      );
    }

    const receiptHash = crypto.createReceiptHash(JSON.stringify({ electionId, nullifier, timestamp: Date.now() }));
    const ledgerEntryHash = domainHashRaw(DOMAIN.ELECTION_BALLOT, receiptHash + ':' + nullifier);

    let result;
    try {
      result = await prisma.$transaction(async tx => {
        // Spending the nullifier is what enforces one vote per credential -
        // the unique constraint makes a double-vote attempt fail atomically
        // rather than racing a separate read-then-write check.
        await tx.nullifier.create({ data: { electionId, nullifier } });

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
            votingTokenHash: nullifier, // anonymous path: no per-voter token, nullifier stands in as the uniqueness key
            eligibilityNullifier: nullifier,
            tallyCiphertexts: tallyCiphertextsJson,
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
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return res.status(409).json({ success: false, error: 'This credential has already voted' });
      }
      throw error;
    }

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
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
