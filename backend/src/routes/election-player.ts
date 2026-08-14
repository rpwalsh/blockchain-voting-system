/**
 * Election playback/visualization: replays recorded votes as a timeline,
 * geographic heatmaps by state/county, and per-vote Merkle-proof
 * verification. See docs/protocol.md for the underlying protocol this
 * visualizes.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { MerkleTree } from '../crypto/engine';

const router = Router();

// Color scheme for parties
const PARTY_COLORS: { [key: string]: string } = {
  'Republican': '#E81B23',
  'Democratic': '#0015BC',
  'Democrat': '#0015BC',
  'Independent': '#FDB927',
  'Green': '#17AA5C',
  'Libertarian': '#FED105',
  'Default': '#999999',
};

/**
 * GET /api/election-player/:electionId/timeline
 * Get complete election timeline for playback
 */
router.get('/:electionId/timeline', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;

    const votes = await prisma.vote.findMany({
      where: { electionId },
      include: {
        candidate: true,
      },
      orderBy: { ledgerTimestamp: 'asc' },
    });

    const timeline = votes.map((vote, index) => ({
      timestamp: vote.ledgerTimestamp,
      candidateId: vote.candidateId,
      candidateName: vote.candidate.name,
      party: vote.candidate.party,
      receiptHash: vote.receiptHash,
      merkleProof: vote.merkleProof,
      sequenceNumber: index + 1,
    }));

    res.json({
      success: true,
      electionId,
      totalVotes: timeline.length,
      duration: timeline.length > 1 
        ? timeline[timeline.length - 1].timestamp.getTime() - timeline[0].timestamp.getTime()
        : 0,
      timeline,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/election-player/:electionId/snapshot/:sequenceNumber
 * Get election state at a specific point in time
 */
router.get('/:electionId/snapshot/:sequenceNumber', async (req: Request, res: Response) => {
  try {
    const { electionId, sequenceNumber } = req.params;
    
    const votes = await prisma.vote.findMany({
      where: { electionId },
      include: {
        candidate: true,
      },
      orderBy: { ledgerTimestamp: 'asc' },
      take: parseInt(sequenceNumber),
    });

    const candidateTotals = new Map<string, {
      name: string;
      party: string | null;
      votes: number;
      percentage: number;
    }>();

    votes.forEach(vote => {
      if (!candidateTotals.has(vote.candidateId)) {
        candidateTotals.set(vote.candidateId, {
          name: vote.candidate.name,
          party: vote.candidate.party,
          votes: 0,
          percentage: 0,
        });
      }
      candidateTotals.get(vote.candidateId)!.votes++;
    });

    const totalVotes = votes.length;
    candidateTotals.forEach(data => {
      data.percentage = totalVotes > 0 ? (data.votes / totalVotes) * 100 : 0;
    });

    res.json({
      success: true,
      electionId,
      sequenceNumber: parseInt(sequenceNumber),
      totalVotes,
      candidates: Object.fromEntries(candidateTotals),
      timestamp: votes.length > 0 ? votes[votes.length - 1].ledgerTimestamp : null,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/election-player/:electionId/stats
 * Get real-time election statistics
 */
router.get('/:electionId/stats', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;

    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        candidates: true,
        _count: {
          select: {
            votes: true,
            voters: true,
          },
        },
      },
    });

    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found' });
    }

    const tallyResults = await prisma.tallyResult.findMany({
      where: { electionId },
    });

    res.json({
      success: true,
      election: {
        id: election.id,
        name: election.name,
        status: election.status,
        startDate: election.startDate,
        endDate: election.endDate,
        totalVotes: election._count.votes,
        totalVoters: election._count.voters,
        merkleRoot: election.merkleRoot,
      },
      candidates: election.candidates.map(candidate => {
        const tally = tallyResults.find(t => t.candidateId === candidate.id);
        return {
          id: candidate.id,
          name: candidate.name,
          party: candidate.party,
          platform: (candidate as any).platform || (candidate as any).description,
          votes: tally?.voteCount || 0,
          percentage: tally?.voteCount && election._count.votes > 0
            ? ((tally.voteCount / election._count.votes) * 100).toFixed(2)
            : '0.00',
          color: PARTY_COLORS[candidate.party || 'Default'] || PARTY_COLORS['Default'],
        };
      }),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/election-player/:electionId/verify-vote
 * Verify a vote's inclusion by recomputing a real Merkle proof from the
 * current vote set, rather than comparing two stored root columns.
 *
 * If the election has been finalized (docs/protocol.md, "Stage:
 * Finalization"), this checks against the signed, immutable
 * finalBallotRoot instead of the live column, which is the actual point
 * of finalizing.
 */
router.post('/:electionId/verify-vote', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const { receiptHash } = req.body;

    const vote = await prisma.vote.findFirst({
      where: {
        electionId,
        receiptHash,
      },
      include: {
        candidate: true,
        election: true,
      },
    });

    if (!vote) {
      return res.status(404).json({
        success: false,
        verified: false,
        error: 'Vote not found',
      });
    }

    const finalization = await prisma.electionFinalization.findUnique({ where: { electionId } });

    const allVotes = await prisma.vote.findMany({
      where: { electionId },
      orderBy: { ledgerTimestamp: 'asc' },
      select: { id: true, encryptedVote: true },
    });
    const voteIndex = allVotes.findIndex(v => v.id === vote.id);
    const tree = new MerkleTree(allVotes.map(v => v.encryptedVote));
    const recomputedProof = tree.getProof(voteIndex);
    const proofValid = MerkleTree.verifyProof(recomputedProof);

    const expectedRoot = finalization ? finalization.finalBallotRoot : vote.election.merkleRoot;
    const rootMatches = expectedRoot === recomputedProof.root;

    res.json({
      success: true,
      verified: proofValid && rootMatches,
      vote: {
        receiptHash: vote.receiptHash,
        candidateName: vote.candidate.name,
        timestamp: vote.ledgerTimestamp,
        merkleProof: recomputedProof,
      },
      checkedAgainst: finalization ? 'signed final root' : 'live election.merkleRoot (not yet finalized)',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
