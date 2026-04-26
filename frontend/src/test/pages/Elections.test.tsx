import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Elections from '../../pages/Elections';
import { electionService } from '../../services/api';

// Mock the api module
vi.mock('../../services/api', () => ({
  electionService: {
    getElections: vi.fn(),
  },
}));

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

const mockElections = [
  {
    id: 'election-1',
    name: 'Presidential Election 2024',
    description: 'United States Presidential Election',
    startDate: '2024-11-01T00:00:00Z',
    endDate: '2024-11-05T23:59:59Z',
    status: 'VOTING',
    stats: {
      candidates: 5,
      registeredVoters: 150000000,
      votesCast: 98000000,
    },
  },
  {
    id: 'election-2',
    name: 'City Council Election',
    description: 'Local city council seats',
    startDate: '2024-10-01T00:00:00Z',
    endDate: '2024-10-15T23:59:59Z',
    status: 'COMPLETED',
    stats: {
      candidates: 12,
      registeredVoters: 50000,
      votesCast: 32000,
    },
  },
  {
    id: 'election-3',
    name: 'School Board Election',
    description: 'School board member positions',
    startDate: '2024-12-01T00:00:00Z',
    endDate: '2024-12-15T23:59:59Z',
    status: 'REGISTRATION',
    stats: {
      candidates: 8,
      registeredVoters: 25000,
      votesCast: 0,
    },
  },
];

describe('Elections Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders page heading', async () => {
      vi.mocked(electionService.getElections).mockResolvedValueOnce({ elections: [] });
      renderWithRouter(<Elections />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /elections/i })).toBeInTheDocument();
      });
    });

    it('renders description text', async () => {
      vi.mocked(electionService.getElections).mockResolvedValueOnce({ elections: [] });
      renderWithRouter(<Elections />);

      await waitFor(() => {
        expect(screen.getByText(/browse all elections/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner while fetching elections', () => {
      vi.mocked(electionService.getElections).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ elections: [] }), 100))
      );

      renderWithRouter(<Elections />);

      expect(screen.getByText(/loading elections/i)).toBeInTheDocument();
    });

    it('shows spinner element', () => {
      vi.mocked(electionService.getElections).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ elections: [] }), 100))
      );

      const { container } = renderWithRouter(<Elections />);

      expect(container.querySelector('.spinner')).toBeInTheDocument();
    });
  });

  describe('Elections List', () => {
    it('displays elections after loading', async () => {
      vi.mocked(electionService.getElections).mockResolvedValueOnce({ elections: mockElections });
      renderWithRouter(<Elections />);

      await waitFor(() => {
        expect(screen.getByText('Presidential Election 2024')).toBeInTheDocument();
        expect(screen.getByText('City Council Election')).toBeInTheDocument();
        expect(screen.getByText('School Board Election')).toBeInTheDocument();
      });
    });

    it('displays election descriptions', async () => {
      vi.mocked(electionService.getElections).mockResolvedValueOnce({ elections: mockElections });
      renderWithRouter(<Elections />);

      await waitFor(() => {
        expect(screen.getByText('United States Presidential Election')).toBeInTheDocument();
      });
    });

    it('displays election statistics', async () => {
      vi.mocked(electionService.getElections).mockResolvedValueOnce({ elections: mockElections });
      renderWithRouter(<Elections />);

      await waitFor(() => {
        // Check candidate counts
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('12')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
      });
    });

    it('displays status badges', async () => {
      vi.mocked(electionService.getElections).mockResolvedValueOnce({ elections: mockElections });
      renderWithRouter(<Elections />);

      await waitFor(() => {
        expect(screen.getByText('VOTING')).toBeInTheDocument();
        expect(screen.getByText('COMPLETED')).toBeInTheDocument();
        expect(screen.getByText('REGISTRATION')).toBeInTheDocument();
      });
    });

    it('displays "Vote Now" button for VOTING status', async () => {
      vi.mocked(electionService.getElections).mockResolvedValueOnce({ elections: mockElections });
      renderWithRouter(<Elections />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /vote now/i })).toBeInTheDocument();
      });
    });

    it('displays "View Results" button for COMPLETED status', async () => {
      vi.mocked(electionService.getElections).mockResolvedValueOnce({ elections: mockElections });
      renderWithRouter(<Elections />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /view results/i })).toBeInTheDocument();
      });
    });

    it('displays "View Details" button for REGISTRATION status', async () => {
      vi.mocked(electionService.getElections).mockResolvedValueOnce({ elections: mockElections });
      renderWithRouter(<Elections />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /view details/i })).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('shows message when no elections found', async () => {
      vi.mocked(electionService.getElections).mockResolvedValueOnce({ elections: [] });
      renderWithRouter(<Elections />);

      await waitFor(() => {
        expect(screen.getByText(/no elections found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message on API failure', async () => {
      vi.mocked(electionService.getElections).mockRejectedValueOnce({
        response: { data: { message: 'Failed to load elections' } },
      });

      renderWithRouter(<Elections />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load elections/i)).toBeInTheDocument();
      });
    });

    it('displays generic error on network failure', async () => {
      vi.mocked(electionService.getElections).mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter(<Elections />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load elections/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('Vote Now button links to vote page', async () => {
      vi.mocked(electionService.getElections).mockResolvedValueOnce({ elections: mockElections });
      renderWithRouter(<Elections />);

      await waitFor(() => {
        const voteNowLink = screen.getByRole('link', { name: /vote now/i });
        expect(voteNowLink).toHaveAttribute('href', '/vote/election-1');
      });
    });

    it('View Results button links to vote page', async () => {
      vi.mocked(electionService.getElections).mockResolvedValueOnce({ elections: mockElections });
      renderWithRouter(<Elections />);

      await waitFor(() => {
        const viewResultsLink = screen.getByRole('link', { name: /view results/i });
        expect(viewResultsLink).toHaveAttribute('href', '/vote/election-2');
      });
    });
  });

  describe('Data Formatting', () => {
    it('displays start and end date labels', async () => {
      vi.mocked(electionService.getElections).mockResolvedValueOnce({ elections: mockElections });
      renderWithRouter(<Elections />);

      await waitFor(() => {
        // Dates should be formatted with toLocaleString
        // Check for the labels
        const startLabels = screen.getAllByText(/start:/i);
        const endLabels = screen.getAllByText(/end:/i);
        expect(startLabels.length).toBeGreaterThan(0);
        expect(endLabels.length).toBeGreaterThan(0);
      });
    });
  });
});
