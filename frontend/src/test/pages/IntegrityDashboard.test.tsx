import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import IntegrityDashboard from '../../pages/IntegrityDashboard';
import {
  cryptoAuditService,
  electionPlayerService,
  finalizationService,
  governanceService,
  operationsService,
  tallyService,
} from '../../services/api';

vi.mock('../../services/api', () => ({
  cryptoAuditService: { getElectionIntegrity: vi.fn() },
  tallyService: { verifyTally: vi.fn(), computeTally: vi.fn() },
  finalizationService: { getFinalization: vi.fn(), getAnchorStatus: vi.fn(), submitAnchor: vi.fn() },
  operationsService: { getObserverStatus: vi.fn(), recount: vi.fn(), getAuditExport: vi.fn() },
  electionPlayerService: { getTimeline: vi.fn(), getStats: vi.fn(), verifyVote: vi.fn() },
  governanceService: { listElections: vi.fn() },
}));

const renderAt = (electionId = 'election-1') =>
  render(
    <MemoryRouter initialEntries={[`/admin/integrity/${electionId}`]}>
      <Routes>
        <Route path="/admin/integrity/:electionId" element={<IntegrityDashboard />} />
      </Routes>
    </MemoryRouter>
  );

const integrityReport = {
  success: true,
  integrityReport: {
    overallStatus: 'VERIFIED',
    checksPerformed: 2,
    checks: [
      { check: 'Merkle Tree Integrity', status: 'PASS', details: { totalLeaves: 10 } },
      { check: 'Ledger Chain Integrity', status: 'PASS', details: { entriesChecked: 10 } },
    ],
  },
};

const observerStatus = {
  success: true,
  observer: {
    voteCount: 10,
    ledgerEntryCount: 10,
    status: 'VOTING',
    finalized: false,
    timestampAnchorConfirmed: null,
  },
};

const statsResponse = {
  success: true,
  candidates: [
    { id: 'c1', name: 'Alice', votes: 6 },
    { id: 'c2', name: 'Bob', votes: 4 },
  ],
};

describe('IntegrityDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(governanceService.listElections).mockRejectedValue(new Error('unauthenticated'));
    vi.mocked(cryptoAuditService.getElectionIntegrity).mockResolvedValue(integrityReport);
    vi.mocked(operationsService.getObserverStatus).mockResolvedValue(observerStatus);
    vi.mocked(electionPlayerService.getTimeline).mockResolvedValue({ success: true, timeline: [] });
    vi.mocked(electionPlayerService.getStats).mockResolvedValue(statsResponse);
    vi.mocked(finalizationService.getFinalization).mockRejectedValue({ response: { status: 404 } });
    vi.mocked(finalizationService.getAnchorStatus).mockResolvedValue({ success: true, anchored: false });
  });

  it('loads and displays the integrity checks for the election in the route', async () => {
    vi.mocked(tallyService.verifyTally).mockRejectedValue({ response: { status: 404 } });
    renderAt();

    await waitFor(() => {
      expect(cryptoAuditService.getElectionIntegrity).toHaveBeenCalledWith('election-1');
    });

    expect(await screen.findByText('VERIFIED')).toBeInTheDocument();
    expect(await screen.findByText('Merkle Tree Integrity')).toBeInTheDocument();
    expect(screen.getByText('Ledger Chain Integrity')).toBeInTheDocument();
  });

  it('shows an honest "not computed" state instead of fabricating a tally', async () => {
    vi.mocked(tallyService.verifyTally).mockRejectedValue({ response: { status: 404 } });
    renderAt();

    expect(await screen.findByText(/no tally has been computed for this election yet/i)).toBeInTheDocument();
    // The candidate chart must not claim cryptographic verification it doesn't have.
    expect(screen.getByText(/live ballot count - pending independent tally verification/i)).toBeInTheDocument();
  });

  it('labels the candidate chart as cryptographically verified only when the tally re-check passes', async () => {
    vi.mocked(tallyService.verifyTally).mockResolvedValue({
      success: true,
      totalBallots: 10,
      allVerified: true,
      results: [
        {
          candidateId: 'c1',
          certifiedVoteCount: 6,
          recomputedVoteCount: 6,
          checks: { ciphertextSumMatches: true, partialDecryptionProofsValid: true, decryptedCountMatches: true },
          verified: true,
        },
        {
          candidateId: 'c2',
          certifiedVoteCount: 4,
          recomputedVoteCount: 4,
          checks: { ciphertextSumMatches: true, partialDecryptionProofsValid: true, decryptedCountMatches: true },
          verified: true,
        },
      ],
    });
    renderAt();

    expect(await screen.findByText(/cryptographically verified tally/i)).toBeInTheDocument();
    // Tally table renders certified vs recomputed counts from the real re-verification.
    expect(screen.getAllByText('6').length).toBeGreaterThan(0);
  });

  it('runs a recount on demand and reports the result', async () => {
    vi.mocked(tallyService.verifyTally).mockRejectedValue({ response: { status: 404 } });
    vi.mocked(operationsService.recount).mockResolvedValue({
      success: true,
      recount: {
        ledgerEntriesChecked: 10,
        ledgerValid: true,
        ledgerIssues: [],
        ballotsChecked: 10,
        recomputedMerkleRoot: 'root',
        merkleMatchesLive: true,
        merkleMatchesFinalized: null,
        tallyRecount: null,
        allMatch: true,
      },
    });

    const user = userEvent.setup();
    renderAt();
    await screen.findByText('VERIFIED');

    await user.click(screen.getByRole('button', { name: /run recount/i }));

    await waitFor(() => {
      expect(operationsService.recount).toHaveBeenCalledWith('election-1');
    });
    expect(await screen.findByText(/independently recomputed values match/i)).toBeInTheDocument();
  });

  it('falls back to manual election ID entry when the authenticated election list is unavailable', async () => {
    renderAt();

    expect(
      await screen.findByText(/sign in as an org admin to browse your elections, or paste an election id directly/i)
    ).toBeInTheDocument();
  });
});
