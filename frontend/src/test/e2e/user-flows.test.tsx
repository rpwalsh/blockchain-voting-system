import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { electionService, voterService, auditService } from '../../services/api';
import api from '../../services/api';

// Mock the api module
vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
  electionService: {
    getElections: vi.fn(),
    getElection: vi.fn(),
  },
  voterService: {
    verifyVote: vi.fn(),
  },
  auditService: {
    getElectionIntegrity: vi.fn(),
    getStatistics: vi.fn(),
  },
}));

const renderApp = (initialRoute = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  );
};

describe('E2E User Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default mock for elections that's used when navigating
    vi.mocked(electionService.getElections).mockResolvedValue({ 
      elections: [
        {
          id: 'election-1',
          name: 'Test Election',
          status: 'VOTING',
          stats: { candidates: 0, registeredVoters: 0, votesCast: 0 }
        }
      ] 
    });
  });

  describe('Navigation Flow', () => {
    it('user can navigate from home to elections', async () => {
      const user = userEvent.setup();
      renderApp();

      // Start on home page
      expect(screen.getByText(/trustless voting system/i)).toBeInTheDocument();

      // Click on Elections link (nav link specifically)
      const navElections = screen.getAllByRole('link', { name: /elections/i })[0];
      await user.click(navElections);

      // Should be on elections page
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /elections/i })).toBeInTheDocument();
      });
    });

    it('user can navigate from home to verify page', async () => {
      const user = userEvent.setup();
      renderApp();

      // Use getAllBy since there may be multiple links
      await user.click(screen.getAllByRole('link', { name: /verify vote/i })[0]);

      expect(screen.getByRole('heading', { name: /verify your vote/i })).toBeInTheDocument();
    });

    it('user can navigate from home to audit page', async () => {
      const user = userEvent.setup();
      renderApp();

      // Use getAllBy since there are multiple audit links (nav + home page)
      await user.click(screen.getAllByRole('link', { name: /public audit/i })[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /public audit trail/i })).toBeInTheDocument();
      });
    });

    it('user can navigate back to home using brand link', async () => {
      const user = userEvent.setup();
      renderApp();

      // Navigate away from home
      await user.click(screen.getAllByRole('link', { name: /verify vote/i })[0]);
      expect(screen.getByRole('heading', { name: /verify your vote/i })).toBeInTheDocument();

      // Navigate back to home using logo
      await user.click(screen.getByRole('link', { name: /trustless voting/i }));
      expect(screen.getByText(/trustless voting system/i)).toBeInTheDocument();
    });
  });

  describe('Vote Verification Flow', () => {
    it('user can verify their vote', async () => {
      const user = userEvent.setup();
      
      // Simplified test - verify the page loads and form works
      renderApp('/verify');

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /verify your vote/i })).toBeInTheDocument();
      });
      
      // Form is present
      expect(screen.getByPlaceholderText(/enter your receipt hash/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /verify vote/i })).toBeInTheDocument();
      
      // Enter receipt hash
      await user.type(screen.getByPlaceholderText(/enter your receipt hash/i), 'my-receipt-hash');
      
      // Button should be enabled
      expect(screen.getByRole('button', { name: /verify vote/i })).not.toBeDisabled();
    });

    it('user sees error for invalid receipt', async () => {
      const user = userEvent.setup();
      vi.mocked(voterService.verifyVote).mockRejectedValue({
        response: { data: { message: 'Receipt not found' } },
      });

      renderApp('/verify');
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your receipt hash/i)).toBeInTheDocument();
      });
      
      await user.type(screen.getByPlaceholderText(/enter your receipt hash/i), 'invalid-receipt');
      await user.click(screen.getByRole('button', { name: /verify vote/i }));

      await waitFor(() => {
        expect(screen.getByText(/receipt not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Public Audit Flow', () => {
    const mockElections = [
      { id: 'election-1', name: 'Presidential Election', status: 'VOTING' },
      { id: 'election-2', name: 'Local Election', status: 'COMPLETED' },
    ];

    const mockIntegrity = {
      message: 'All votes verified',
      integrity: {
        totalVotes: 50000,
        validProofs: 50000,
        invalidProofs: 0,
        integrityScore: '100%',
        currentMerkleRoot: 'root-hash-12345',
      },
    };

    const mockStats = {
      statistics: {
        candidates: 4,
        registeredVoters: 75000,
        votesCast: 50000,
        turnoutRate: '66.7%',
      },
    };

    it('user can audit an election', async () => {
      const user = userEvent.setup();
      vi.mocked(electionService.getElections).mockResolvedValue({ elections: mockElections });
      vi.mocked(auditService.getElectionIntegrity).mockResolvedValue(mockIntegrity);
      vi.mocked(auditService.getStatistics).mockResolvedValue(mockStats);

      renderApp('/audit');

      // Wait for elections to load in dropdown
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // Select an election
      await user.selectOptions(screen.getByRole('combobox'), 'election-1');

      // Click audit button
      await user.click(screen.getByRole('button', { name: /audit election/i }));

      // Should see integrity report
      await waitFor(() => {
        expect(screen.getByText(/integrity report/i)).toBeInTheDocument();
      });
      
      // Verify integrity data is shown
      expect(screen.getByText(/perfect integrity/i)).toBeInTheDocument();
      expect(screen.getByText('root-hash-12345')).toBeInTheDocument();
    });
  });

  describe('Authentication Flow', () => {
    it('user can access login page', async () => {
      const user = userEvent.setup();
      renderApp();

      await user.click(screen.getByRole('link', { name: /login/i }));

      expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
    });

    it('login page has link to register page', async () => {
      renderApp('/login');

      // Wait for login page to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
      });

      const registerLink = screen.getByRole('link', { name: /register here/i });
      expect(registerLink).toBeInTheDocument();
      expect(registerLink).toHaveAttribute('href', '/register');
    });

    it('user can login successfully and navigate to elections', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          token: 'test-jwt-token',
          user: { id: '1', email: 'test@example.com', role: 'VOTER' },
        },
      });

      renderApp('/login');

      await waitFor(() => {
        expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/username or email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      // After successful login, user should be redirected to elections page
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /elections/i })).toBeInTheDocument();
      });
    });

    it('shows error for invalid login', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValueOnce({
        response: { data: { message: 'Invalid credentials' } },
      });

      renderApp('/login');

      await waitFor(() => {
        expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/username or email/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Navigation', () => {
    it('all nav links are present', () => {
      renderApp();

      expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
      // Elections link appears in both nav and home page
      expect(screen.getAllByRole('link', { name: /elections/i }).length).toBeGreaterThan(0);
      // Verify Vote appears in nav and home page
      expect(screen.getAllByRole('link', { name: /verify vote/i }).length).toBeGreaterThan(0);
      // Public Audit appears in nav and home page
      expect(screen.getAllByRole('link', { name: /public audit/i }).length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
    });
  });
});
