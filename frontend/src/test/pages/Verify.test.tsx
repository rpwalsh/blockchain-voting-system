import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Verify from '../../pages/Verify';
import { cryptoAuditService, electionPlayerService } from '../../services/api';

// Mock the api module
vi.mock('../../services/api', () => ({
  electionPlayerService: {
    verifyVote: vi.fn(),
  },
  cryptoAuditService: {
    getMerkleTree: vi.fn().mockResolvedValue({ merkleTree: null }),
  },
  governanceService: {
    listPublicElections: vi.fn(),
  },
}));

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>, electionId = 'election-1', receiptHash = 'receipt-hash-abc') => {
  await user.type(screen.getByLabelText(/election id/i), electionId);
  await user.type(screen.getByLabelText(/receipt hash/i), receiptHash);
  await user.click(screen.getByRole('button', { name: /^verify$/i }));
};

const mockMerkleProof = {
  root: 'root-hash-0123456789abcdef',
  leaf: 'leaf-hash-0123456789abcdef',
  index: 2,
  algorithm: 'SHA3-256, domain-separated',
  siblings: [
    { left: false, hash: 'sibling-level-1-hash' },
    { left: true, hash: 'sibling-level-2-hash' },
  ],
};

describe('Verify Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cryptoAuditService.getMerkleTree).mockResolvedValue({ merkleTree: null });
  });

  describe('Rendering', () => {
    it('renders page heading', () => {
      renderWithRouter(<Verify />);

      expect(screen.getByRole('heading', { name: /verify your vote/i })).toBeInTheDocument();
    });

    it('renders election ID and receipt hash inputs', () => {
      renderWithRouter(<Verify />);

      expect(screen.getByLabelText(/election id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/receipt hash/i)).toBeInTheDocument();
    });

    it('renders verify button', () => {
      renderWithRouter(<Verify />);

      expect(screen.getByRole('button', { name: /^verify$/i })).toBeInTheDocument();
    });

    it('renders "How verification works" section', () => {
      renderWithRouter(<Verify />);

      expect(screen.getByRole('heading', { name: /how verification works/i })).toBeInTheDocument();
    });

    it('renders the organization lookup helper', () => {
      renderWithRouter(<Verify />);

      expect(screen.getByText(/don't know your election id/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('shows a validation message when submitted empty', async () => {
      const user = userEvent.setup();
      renderWithRouter(<Verify />);

      await user.click(screen.getByRole('button', { name: /^verify$/i }));

      expect(await screen.findByText(/enter both the election id and your receipt hash/i)).toBeInTheDocument();
      expect(electionPlayerService.verifyVote).not.toHaveBeenCalled();
    });
  });

  describe('Verification Flow', () => {
    it('calls verifyVote with election ID and receipt hash', async () => {
      const user = userEvent.setup();
      vi.mocked(electionPlayerService.verifyVote).mockResolvedValueOnce({
        success: true,
        verified: true,
        checkedAgainst: 'signed final root',
        vote: {
          receiptHash: 'receipt-hash-abc',
          candidateName: 'Should never be rendered',
          timestamp: new Date().toISOString(),
          merkleProof: mockMerkleProof,
        },
      });

      renderWithRouter(<Verify />);
      await fillAndSubmit(user);

      await waitFor(() => {
        expect(electionPlayerService.verifyVote).toHaveBeenCalledWith('election-1', 'receipt-hash-abc');
      });
    });

    it('shows a success banner and the Merkle proof steps when verified', async () => {
      const user = userEvent.setup();
      vi.mocked(electionPlayerService.verifyVote).mockResolvedValueOnce({
        success: true,
        verified: true,
        checkedAgainst: 'signed final root',
        vote: {
          receiptHash: 'receipt-hash-abc',
          candidateName: 'Should never be rendered',
          timestamp: new Date().toISOString(),
          merkleProof: mockMerkleProof,
        },
      });

      renderWithRouter(<Verify />);
      await fillAndSubmit(user);

      expect(await screen.findByText(/proof checks out/i)).toBeInTheDocument();
      expect(screen.getByText(/ballot located/i)).toBeInTheDocument();
      expect(screen.getByText(/leaf hash computed/i)).toBeInTheDocument();
      expect(screen.getByText(/compared to the election's merkle root/i)).toBeInTheDocument();
      // One step per sibling in the real proof
      expect(screen.getByText(/combine at level 1 of 2/i)).toBeInTheDocument();
      expect(screen.getByText(/combine at level 2 of 2/i)).toBeInTheDocument();
    });

    it('never renders the candidate name, even though the API returns one', async () => {
      const user = userEvent.setup();
      vi.mocked(electionPlayerService.verifyVote).mockResolvedValueOnce({
        success: true,
        verified: true,
        checkedAgainst: 'signed final root',
        vote: {
          receiptHash: 'receipt-hash-abc',
          candidateName: 'Definitely Secret Candidate',
          timestamp: new Date().toISOString(),
          merkleProof: mockMerkleProof,
        },
      });

      renderWithRouter(<Verify />);
      await fillAndSubmit(user);

      await screen.findByText(/proof checks out/i);
      expect(screen.queryByText(/definitely secret candidate/i)).not.toBeInTheDocument();
    });

    it('shows a failure banner when the proof does not verify', async () => {
      const user = userEvent.setup();
      vi.mocked(electionPlayerService.verifyVote).mockResolvedValueOnce({
        success: true,
        verified: false,
        checkedAgainst: 'live election.merkleRoot (not yet finalized)',
        vote: {
          receiptHash: 'receipt-hash-abc',
          timestamp: new Date().toISOString(),
          merkleProof: mockMerkleProof,
        },
      });

      renderWithRouter(<Verify />);
      await fillAndSubmit(user);

      expect(await screen.findByText(/could not be verified/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows a not-found message for a 404 response', async () => {
      const user = userEvent.setup();
      vi.mocked(electionPlayerService.verifyVote).mockRejectedValueOnce({
        response: { status: 404, data: { error: 'Vote not found' } },
      });

      renderWithRouter(<Verify />);
      await fillAndSubmit(user);

      expect(await screen.findByText(/no ballot was found/i)).toBeInTheDocument();
    });

    it('shows a generic error message on network failure', async () => {
      const user = userEvent.setup();
      vi.mocked(electionPlayerService.verifyVote).mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter(<Verify />);
      await fillAndSubmit(user);

      expect(await screen.findByText(/could not reach the verification service/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows a loading state during verification', async () => {
      const user = userEvent.setup();
      vi.mocked(electionPlayerService.verifyVote).mockImplementation(
        () => new Promise(() => {}) // never resolves within the test
      );

      renderWithRouter(<Verify />);
      await user.type(screen.getByLabelText(/election id/i), 'election-1');
      await user.type(screen.getByLabelText(/receipt hash/i), 'receipt-hash-abc');
      await user.click(screen.getByRole('button', { name: /^verify$/i }));

      expect(screen.getByRole('button', { name: /verifying/i })).toBeDisabled();
    });
  });
});
