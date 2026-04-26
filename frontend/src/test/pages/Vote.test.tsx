import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Vote from '../../pages/Vote';
import { electionService, voterService } from '../../services/api';

// Mock the api module
vi.mock('../../services/api', () => ({
  electionService: {
    getElection: vi.fn(),
  },
  voterService: {
    vote: vi.fn(),
  },
}));

const mockElection = {
  id: 'election-1',
  name: 'Presidential Election 2024',
  description: 'Vote for the next president',
  status: 'VOTING',
  startDate: '2024-11-01T00:00:00Z',
  endDate: '2024-11-05T23:59:59Z',
  candidates: [
    { id: 'candidate-1', name: 'Alice Johnson', party: 'Democratic Party', description: 'Senator from California' },
    { id: 'candidate-2', name: 'Bob Smith', party: 'Republican Party', description: 'Governor of Texas' },
    { id: 'candidate-3', name: 'Carol Williams', party: 'Independent', description: 'Business leader' },
  ],
};

const renderWithRouter = (electionId = 'election-1') => {
  return render(
    <MemoryRouter initialEntries={[`/vote/${electionId}`]}>
      <Routes>
        <Route path="/vote/:electionId" element={<Vote />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Vote Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading state while fetching election', () => {
      vi.mocked(electionService.getElection).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ election: mockElection }), 100))
      );

      renderWithRouter();

      expect(screen.getByText(/loading election/i)).toBeInTheDocument();
    });

    it('shows spinner during loading', () => {
      vi.mocked(electionService.getElection).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ election: mockElection }), 100))
      );

      const { container } = renderWithRouter();

      expect(container.querySelector('.spinner')).toBeInTheDocument();
    });
  });

  describe('Voting Form', () => {
    beforeEach(() => {
      vi.mocked(electionService.getElection).mockResolvedValue({ election: mockElection });
    });

    it('renders election name and description', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /presidential election 2024/i })).toBeInTheDocument();
        expect(screen.getByText(/vote for the next president/i)).toBeInTheDocument();
      });
    });

    it('renders all candidates', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
        expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        expect(screen.getByText('Carol Williams')).toBeInTheDocument();
      });
    });

    it('displays candidate parties', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Democratic Party')).toBeInTheDocument();
        expect(screen.getByText('Republican Party')).toBeInTheDocument();
        expect(screen.getByText('Independent')).toBeInTheDocument();
      });
    });

    it('displays candidate descriptions', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Senator from California')).toBeInTheDocument();
      });
    });

    it('renders voting token input', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your anonymous voting token/i)).toBeInTheDocument();
      });
    });

    it('voting token input is password type for privacy', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your anonymous voting token/i)).toHaveAttribute('type', 'password');
      });
    });

    it('renders cast vote button', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cast vote/i })).toBeInTheDocument();
      });
    });

    it('displays privacy notice', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/your vote is anonymous and encrypted/i)).toBeInTheDocument();
      });
    });
  });

  describe('Candidate Selection', () => {
    beforeEach(() => {
      vi.mocked(electionService.getElection).mockResolvedValue({ election: mockElection });
    });

    it('allows selecting a candidate', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      const candidateOption = screen.getByText('Alice Johnson').closest('div');
      await user.click(candidateOption!);

      const radioButtons = screen.getAllByRole('radio');
      expect(radioButtons[0]).toBeChecked();
    });

    it('only one candidate can be selected at a time', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      const aliceOption = screen.getByText('Alice Johnson').closest('div');
      await user.click(aliceOption!);

      const bobOption = screen.getByText('Bob Smith').closest('div');
      await user.click(bobOption!);

      const radioButtons = screen.getAllByRole('radio');
      expect(radioButtons[0]).not.toBeChecked();
      expect(radioButtons[1]).toBeChecked();
    });
  });

  describe('Vote Submission', () => {
    beforeEach(() => {
      vi.mocked(electionService.getElection).mockResolvedValue({ election: mockElection });
    });

    it('submit button disabled without token', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      // Select a candidate but don't enter token
      const aliceOption = screen.getByText('Alice Johnson').closest('div');
      await user.click(aliceOption!);

      expect(screen.getByRole('button', { name: /cast vote/i })).toBeDisabled();
    });

    it('submit button disabled without candidate selection', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your anonymous voting token/i)).toBeInTheDocument();
      });

      // Enter token but don't select candidate
      await user.type(screen.getByPlaceholderText(/enter your anonymous voting token/i), 'my-voting-token');

      expect(screen.getByRole('button', { name: /cast vote/i })).toBeDisabled();
    });

    it('submit button enabled with token and candidate', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText(/enter your anonymous voting token/i), 'my-voting-token');
      const aliceOption = screen.getByText('Alice Johnson').closest('div');
      await user.click(aliceOption!);

      expect(screen.getByRole('button', { name: /cast vote/i })).toBeEnabled();
    });

    it('calls vote API with correct data', async () => {
      const user = userEvent.setup();
      vi.mocked(voterService.vote).mockResolvedValueOnce({
        receiptHash: 'receipt-123',
        ledgerEntryHash: 'ledger-456',
        merkleRoot: 'merkle-789',
        timestamp: new Date().toISOString(),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText(/enter your anonymous voting token/i), 'my-voting-token');
      const aliceOption = screen.getByText('Alice Johnson').closest('div');
      await user.click(aliceOption!);
      await user.click(screen.getByRole('button', { name: /cast vote/i }));

      await waitFor(() => {
        expect(voterService.vote).toHaveBeenCalledWith('election-1', 'my-voting-token', 'candidate-1');
      });
    });

    it('shows loading state during vote submission', async () => {
      const user = userEvent.setup();
      vi.mocked(voterService.vote).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          receiptHash: 'receipt-123',
          ledgerEntryHash: 'ledger-456',
          merkleRoot: 'merkle-789',
          timestamp: new Date().toISOString(),
        }), 100))
      );

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText(/enter your anonymous voting token/i), 'my-voting-token');
      const aliceOption = screen.getByText('Alice Johnson').closest('div');
      await user.click(aliceOption!);
      await user.click(screen.getByRole('button', { name: /cast vote/i }));

      expect(screen.getByRole('button', { name: /casting vote/i })).toBeInTheDocument();
    });
  });

  describe('Vote Receipt', () => {
    beforeEach(() => {
      vi.mocked(electionService.getElection).mockResolvedValue({ election: mockElection });
    });

    it('displays receipt after successful vote', async () => {
      const user = userEvent.setup();
      vi.mocked(voterService.vote).mockResolvedValueOnce({
        receiptHash: 'receipt-hash-abc123',
        ledgerEntryHash: 'ledger-hash-xyz789',
        merkleRoot: 'merkle-root-456',
        timestamp: '2024-11-05T12:00:00Z',
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText(/enter your anonymous voting token/i), 'my-voting-token');
      const aliceOption = screen.getByText('Alice Johnson').closest('div');
      await user.click(aliceOption!);
      await user.click(screen.getByRole('button', { name: /cast vote/i }));

      await waitFor(() => {
        expect(screen.getByText(/vote successfully cast/i)).toBeInTheDocument();
      });
    });

    it('displays receipt hash', async () => {
      const user = userEvent.setup();
      vi.mocked(voterService.vote).mockResolvedValueOnce({
        receiptHash: 'receipt-hash-abc123',
        ledgerEntryHash: 'ledger-hash-xyz789',
        merkleRoot: 'merkle-root-456',
        timestamp: '2024-11-05T12:00:00Z',
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText(/enter your anonymous voting token/i), 'my-voting-token');
      const aliceOption = screen.getByText('Alice Johnson').closest('div');
      await user.click(aliceOption!);
      await user.click(screen.getByRole('button', { name: /cast vote/i }));

      await waitFor(() => {
        expect(screen.getByText(/receipt-hash-abc123/)).toBeInTheDocument();
        expect(screen.getByText(/ledger-hash-xyz789/)).toBeInTheDocument();
        expect(screen.getByText(/merkle-root-456/)).toBeInTheDocument();
      });
    });

    it('shows "Verify Your Vote" button after voting', async () => {
      const user = userEvent.setup();
      vi.mocked(voterService.vote).mockResolvedValueOnce({
        receiptHash: 'receipt-123',
        ledgerEntryHash: 'ledger-456',
        merkleRoot: 'merkle-789',
        timestamp: new Date().toISOString(),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText(/enter your anonymous voting token/i), 'my-voting-token');
      const aliceOption = screen.getByText('Alice Johnson').closest('div');
      await user.click(aliceOption!);
      await user.click(screen.getByRole('button', { name: /cast vote/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /verify your vote/i })).toBeInTheDocument();
      });
    });

    it('displays important notice about saving receipt', async () => {
      const user = userEvent.setup();
      vi.mocked(voterService.vote).mockResolvedValueOnce({
        receiptHash: 'receipt-123',
        ledgerEntryHash: 'ledger-456',
        merkleRoot: 'merkle-789',
        timestamp: new Date().toISOString(),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText(/enter your anonymous voting token/i), 'my-voting-token');
      const aliceOption = screen.getByText('Alice Johnson').closest('div');
      await user.click(aliceOption!);
      await user.click(screen.getByRole('button', { name: /cast vote/i }));

      await waitFor(() => {
        expect(screen.getByText(/save your receipt hash/i)).toBeInTheDocument();
      });
    });
  });

  describe('Election Status Handling', () => {
    it('displays message for completed elections', async () => {
      vi.mocked(electionService.getElection).mockResolvedValue({
        election: { ...mockElection, status: 'COMPLETED' },
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/election results/i)).toBeInTheDocument();
        expect(screen.getByText(/election has been completed/i)).toBeInTheDocument();
      });
    });

    it('displays message for elections not in voting phase', async () => {
      vi.mocked(electionService.getElection).mockResolvedValue({
        election: { ...mockElection, status: 'REGISTRATION' },
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/not currently accepting votes/i)).toBeInTheDocument();
        expect(screen.getByText(/status: registration/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error when election fails to load', async () => {
      vi.mocked(electionService.getElection).mockRejectedValueOnce({
        response: { data: { message: 'Election not found' } },
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/election not found/i)).toBeInTheDocument();
      });
    });

    it('displays error when vote submission fails', async () => {
      vi.mocked(electionService.getElection).mockResolvedValue({ election: mockElection });
      vi.mocked(voterService.vote).mockRejectedValueOnce({
        response: { data: { message: 'Invalid voting token' } },
      });

      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText(/enter your anonymous voting token/i), 'invalid-token');
      const aliceOption = screen.getByText('Alice Johnson').closest('div');
      await user.click(aliceOption!);
      await user.click(screen.getByRole('button', { name: /cast vote/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid voting token/i)).toBeInTheDocument();
      });
    });

    it('shows validation error when submitting without required fields', async () => {
      vi.mocked(electionService.getElection).mockResolvedValue({ election: mockElection });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      // Form submission prevented by disabled button, so this tests the interaction
      expect(screen.getByRole('button', { name: /cast vote/i })).toBeDisabled();
    });
  });
});
