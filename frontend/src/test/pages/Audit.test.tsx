import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Audit from '../../pages/Audit';
import { electionService, auditService } from '../../services/api';

// Mock the api module
vi.mock('../../services/api', () => ({
  electionService: {
    getElections: vi.fn(),
  },
  auditService: {
    getElectionIntegrity: vi.fn(),
    getStatistics: vi.fn(),
  },
}));

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

const mockElections = [
  { id: 'election-1', name: 'Presidential Election 2024', status: 'VOTING' },
  { id: 'election-2', name: 'City Council Election', status: 'COMPLETED' },
];

const mockIntegrity = {
  message: 'All votes have valid cryptographic proofs',
  integrity: {
    totalVotes: 150000,
    validProofs: 150000,
    invalidProofs: 0,
    integrityScore: '100%',
    currentMerkleRoot: 'abc123def456789merkleroot',
  },
};

const mockStatistics = {
  statistics: {
    candidates: 5,
    registeredVoters: 200000,
    votesCast: 150000,
    turnoutRate: '75%',
  },
};

describe('Audit Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(electionService.getElections).mockResolvedValue({ elections: mockElections });
  });

  describe('Rendering', () => {
    it('renders page heading', async () => {
      renderWithRouter(<Audit />);

      expect(screen.getByRole('heading', { name: /public audit trail/i })).toBeInTheDocument();
    });

    it('renders description text', async () => {
      renderWithRouter(<Audit />);

      expect(screen.getByText(/verify the integrity of any election/i)).toBeInTheDocument();
    });

    it('renders election selection dropdown', async () => {
      renderWithRouter(<Audit />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('renders audit button', async () => {
      renderWithRouter(<Audit />);

      expect(screen.getByRole('button', { name: /audit election/i })).toBeInTheDocument();
    });

    it('renders "What You Can Audit" section', async () => {
      renderWithRouter(<Audit />);

      expect(screen.getByRole('heading', { name: /what you can audit/i })).toBeInTheDocument();
    });
  });

  describe('Election Selection', () => {
    it('loads elections into dropdown', async () => {
      renderWithRouter(<Audit />);

      await waitFor(() => {
        expect(screen.getByText('Presidential Election 2024 (VOTING)')).toBeInTheDocument();
        expect(screen.getByText('City Council Election (COMPLETED)')).toBeInTheDocument();
      });
    });

    it('has default empty option', async () => {
      renderWithRouter(<Audit />);

      await waitFor(() => {
        expect(screen.getByText(/-- select an election --/i)).toBeInTheDocument();
      });
    });

    it('audit button is disabled when no election selected', async () => {
      renderWithRouter(<Audit />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /audit election/i })).toBeDisabled();
      });
    });

    it('audit button is enabled when election is selected', async () => {
      const user = userEvent.setup();
      renderWithRouter(<Audit />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByRole('combobox'), 'election-1');

      expect(screen.getByRole('button', { name: /audit election/i })).toBeEnabled();
    });
  });

  describe('Audit Flow', () => {
    it('calls audit APIs when audit button clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(auditService.getElectionIntegrity).mockResolvedValueOnce(mockIntegrity);
      vi.mocked(auditService.getStatistics).mockResolvedValueOnce(mockStatistics);

      renderWithRouter(<Audit />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByRole('combobox'), 'election-1');
      await user.click(screen.getByRole('button', { name: /audit election/i }));

      await waitFor(() => {
        expect(auditService.getElectionIntegrity).toHaveBeenCalledWith('election-1');
        expect(auditService.getStatistics).toHaveBeenCalledWith('election-1');
      });
    });

    it('displays integrity report after audit', async () => {
      const user = userEvent.setup();
      vi.mocked(auditService.getElectionIntegrity).mockResolvedValueOnce(mockIntegrity);
      vi.mocked(auditService.getStatistics).mockResolvedValueOnce(mockStatistics);

      renderWithRouter(<Audit />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByRole('combobox'), 'election-1');
      await user.click(screen.getByRole('button', { name: /audit election/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /integrity report/i })).toBeInTheDocument();
      });
    });

    it('displays vote counts', async () => {
      const user = userEvent.setup();
      vi.mocked(auditService.getElectionIntegrity).mockResolvedValue(mockIntegrity);
      vi.mocked(auditService.getStatistics).mockResolvedValue(mockStatistics);

      renderWithRouter(<Audit />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByRole('combobox'), 'election-1');
      await user.click(screen.getByRole('button', { name: /audit election/i }));

      // Wait for integrity report to be displayed first
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /integrity report/i })).toBeInTheDocument();
      });
      
      // Then check that valid proofs label appears
      expect(screen.getAllByText(/valid proofs/i).length).toBeGreaterThan(0);
    });

    it('displays perfect integrity message when all proofs valid', async () => {
      const user = userEvent.setup();
      vi.mocked(auditService.getElectionIntegrity).mockResolvedValueOnce(mockIntegrity);
      vi.mocked(auditService.getStatistics).mockResolvedValueOnce(mockStatistics);

      renderWithRouter(<Audit />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByRole('combobox'), 'election-1');
      await user.click(screen.getByRole('button', { name: /audit election/i }));

      await waitFor(() => {
        expect(screen.getByText(/perfect integrity/i)).toBeInTheDocument();
      });
    });

    it('displays warning when invalid proofs found', async () => {
      const user = userEvent.setup();
      vi.mocked(auditService.getElectionIntegrity).mockResolvedValueOnce({
        ...mockIntegrity,
        message: 'Some votes have invalid proofs',
        integrity: {
          ...mockIntegrity.integrity,
          invalidProofs: 5,
        },
      });
      vi.mocked(auditService.getStatistics).mockResolvedValueOnce(mockStatistics);

      renderWithRouter(<Audit />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByRole('combobox'), 'election-1');
      await user.click(screen.getByRole('button', { name: /audit election/i }));

      await waitFor(() => {
        expect(screen.getByText(/integrity issues detected/i)).toBeInTheDocument();
      });
    });

    it('displays statistics after audit', async () => {
      const user = userEvent.setup();
      vi.mocked(auditService.getElectionIntegrity).mockResolvedValueOnce(mockIntegrity);
      vi.mocked(auditService.getStatistics).mockResolvedValueOnce(mockStatistics);

      renderWithRouter(<Audit />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByRole('combobox'), 'election-1');
      await user.click(screen.getByRole('button', { name: /audit election/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /election statistics/i })).toBeInTheDocument();
        expect(screen.getByText('75%')).toBeInTheDocument(); // Turnout rate
      });
    });

    it('displays merkle root', async () => {
      const user = userEvent.setup();
      vi.mocked(auditService.getElectionIntegrity).mockResolvedValueOnce(mockIntegrity);
      vi.mocked(auditService.getStatistics).mockResolvedValueOnce(mockStatistics);

      renderWithRouter(<Audit />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByRole('combobox'), 'election-1');
      await user.click(screen.getByRole('button', { name: /audit election/i }));

      await waitFor(() => {
        expect(screen.getByText(/abc123def456789merkleroot/)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading state during audit', async () => {
      const user = userEvent.setup();
      vi.mocked(auditService.getElectionIntegrity).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockIntegrity), 100))
      );
      vi.mocked(auditService.getStatistics).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockStatistics), 100))
      );

      renderWithRouter(<Audit />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByRole('combobox'), 'election-1');
      await user.click(screen.getByRole('button', { name: /audit election/i }));

      expect(screen.getByRole('button', { name: /auditing/i })).toBeInTheDocument();
    });
  });

  describe('What You Can Audit Section', () => {
    it('displays all audit capabilities', async () => {
      renderWithRouter(<Audit />);

      expect(screen.getByText(/integrity verification/i)).toBeInTheDocument();
      expect(screen.getByText(/vote counting/i)).toBeInTheDocument();
      expect(screen.getByText(/turnout statistics/i)).toBeInTheDocument();
      expect(screen.getByText(/ledger entries/i)).toBeInTheDocument();
      expect(screen.getByText(/cryptographic proofs/i)).toBeInTheDocument();
    });

    it('displays transparency notice', async () => {
      renderWithRouter(<Audit />);

      expect(screen.getByText(/fully transparent/i)).toBeInTheDocument();
    });
  });
});
