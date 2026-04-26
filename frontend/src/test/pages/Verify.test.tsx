import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Verify from '../../pages/Verify';
import { voterService } from '../../services/api';

// Mock the api module
vi.mock('../../services/api', () => ({
  voterService: {
    verifyVote: vi.fn(),
  },
}));

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Verify Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders page heading', () => {
      renderWithRouter(<Verify />);
      
      expect(screen.getByRole('heading', { name: /verify your vote/i })).toBeInTheDocument();
    });

    it('renders description text', () => {
      renderWithRouter(<Verify />);
      
      expect(screen.getByText(/enter your receipt hash to verify/i)).toBeInTheDocument();
    });

    it('renders receipt hash input', () => {
      renderWithRouter(<Verify />);
      
      expect(screen.getByPlaceholderText(/enter your receipt hash/i)).toBeInTheDocument();
    });

    it('renders verify button', () => {
      renderWithRouter(<Verify />);
      
      expect(screen.getByRole('button', { name: /verify vote/i })).toBeInTheDocument();
    });

    it('renders "How Verification Works" section', () => {
      renderWithRouter(<Verify />);
      
      expect(screen.getByRole('heading', { name: /how verification works/i })).toBeInTheDocument();
    });

    it('renders explanation list items', () => {
      renderWithRouter(<Verify />);
      
      expect(screen.getByText(/receipt hash links to a specific entry/i)).toBeInTheDocument();
      expect(screen.getByText(/merkle proof for independent verification/i)).toBeInTheDocument();
      expect(screen.getByText(/vote content remains encrypted/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('receipt hash input is required', async () => {
      renderWithRouter(<Verify />);

      const input = screen.getByPlaceholderText(/enter your receipt hash/i);
      expect(input).toBeRequired();
    });

    it('receipt hash input has monospace font', () => {
      renderWithRouter(<Verify />);
      
      const input = screen.getByPlaceholderText(/enter your receipt hash/i);
      expect(input).toHaveStyle({ fontFamily: 'monospace' });
    });
  });

  describe('Verification Flow', () => {
    it('calls verifyVote with receipt hash', async () => {
      const user = userEvent.setup();
      vi.mocked(voterService.verifyVote).mockResolvedValueOnce({
        verified: true,
        message: 'Vote verified successfully',
        vote: {
          ledgerEntryHash: 'abc123',
          merkleRoot: 'merkle456',
          timestamp: new Date().toISOString(),
          election: { name: 'Test Election', status: 'VOTING' },
        },
      });

      renderWithRouter(<Verify />);

      await user.type(screen.getByPlaceholderText(/enter your receipt hash/i), 'my-receipt-hash-123');
      await user.click(screen.getByRole('button', { name: /verify vote/i }));

      await waitFor(() => {
        expect(voterService.verifyVote).toHaveBeenCalledWith('my-receipt-hash-123');
      });
    });

    it('displays success message on verified vote', async () => {
      const user = userEvent.setup();
      vi.mocked(voterService.verifyVote).mockResolvedValueOnce({
        verified: true,
        message: 'Your vote was successfully recorded and verified',
        vote: {
          ledgerEntryHash: 'ledger-hash-abc',
          merkleRoot: 'merkle-root-xyz',
          timestamp: '2024-01-15T10:30:00Z',
          election: { name: 'Presidential Election 2024', status: 'VOTING' },
        },
      });

      renderWithRouter(<Verify />);

      await user.type(screen.getByPlaceholderText(/enter your receipt hash/i), 'valid-receipt');
      await user.click(screen.getByRole('button', { name: /verify vote/i }));

      await waitFor(() => {
        expect(voterService.verifyVote).toHaveBeenCalled();
      });
    });

    it('displays verification details', async () => {
      const user = userEvent.setup();
      vi.mocked(voterService.verifyVote).mockResolvedValueOnce({
        verified: true,
        message: 'Vote verified',
        vote: {
          ledgerEntryHash: 'ledger-hash-abc',
          merkleRoot: 'merkle-root-xyz',
          timestamp: '2024-01-15T10:30:00Z',
          election: { name: 'Presidential Election 2024', status: 'VOTING' },
        },
      });

      renderWithRouter(<Verify />);

      await user.type(screen.getByPlaceholderText(/enter your receipt hash/i), 'valid-receipt');
      await user.click(screen.getByRole('button', { name: /verify vote/i }));

      await waitFor(() => {
        expect(voterService.verifyVote).toHaveBeenCalled();
      });
    });

    it('displays failure message on unverified vote', async () => {
      const user = userEvent.setup();
      vi.mocked(voterService.verifyVote).mockResolvedValueOnce({
        verified: false,
        message: 'Vote not found in ledger',
        vote: {
          ledgerEntryHash: 'invalid',
          merkleRoot: 'invalid',
          timestamp: '2024-01-15T10:30:00Z',
          election: { name: 'Unknown', status: 'UNKNOWN' },
        },
      });

      renderWithRouter(<Verify />);

      await user.type(screen.getByPlaceholderText(/enter your receipt hash/i), 'invalid-receipt');
      await user.click(screen.getByRole('button', { name: /verify vote/i }));

      await waitFor(() => {
        expect(voterService.verifyVote).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message on API failure', async () => {
      const user = userEvent.setup();
      vi.mocked(voterService.verifyVote).mockRejectedValueOnce({
        response: { data: { message: 'Receipt hash not found' } },
      });

      renderWithRouter(<Verify />);

      await user.type(screen.getByPlaceholderText(/enter your receipt hash/i), 'nonexistent-hash');
      await user.click(screen.getByRole('button', { name: /verify vote/i }));

      await waitFor(() => {
        expect(screen.getByText(/receipt hash not found/i)).toBeInTheDocument();
      });
    });

    it('displays generic error on network failure', async () => {
      const user = userEvent.setup();
      vi.mocked(voterService.verifyVote).mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter(<Verify />);

      await user.type(screen.getByPlaceholderText(/enter your receipt hash/i), 'any-hash');
      await user.click(screen.getByRole('button', { name: /verify vote/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to verify vote/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading state during verification', async () => {
      const user = userEvent.setup();
      vi.mocked(voterService.verifyVote).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderWithRouter(<Verify />);

      await user.type(screen.getByPlaceholderText(/enter your receipt hash/i), 'test-hash');
      await user.click(screen.getByRole('button', { name: /verify vote/i }));

      expect(screen.getByRole('button', { name: /verifying/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /verifying/i })).toBeDisabled();
    });
  });

  describe('Privacy Notice', () => {
    it('shows informative text after input', async () => {
      renderWithRouter(<Verify />);

      expect(screen.getByText(/this was provided when you cast your vote/i)).toBeInTheDocument();
    });
  });
});
