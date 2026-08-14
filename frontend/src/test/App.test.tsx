import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from '../App';
import { electionService } from '../services/api';

// Mock the api module
vi.mock('../services/api', () => ({
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
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(electionService.getElections).mockResolvedValue({ 
      elections: [{ id: '1', name: 'Test Election', status: 'VOTING', stats: { candidates: 0, registeredVoters: 0, votesCast: 0 } }] 
    });
    vi.mocked(electionService.getElection).mockResolvedValue({ 
      election: { id: '1', name: 'Test Election', status: 'VOTING', candidates: [] } 
    });
  });

  describe('Navigation', () => {
    it('renders navigation links', () => {
      render(<App />, { wrapper: BrowserRouter });
      
      expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
      // Elections link appears in both nav and possibly home page
      expect(screen.getAllByRole('link', { name: /elections/i }).length).toBeGreaterThan(0);
      // Verify appears in the nav and (as "Verify Your Vote"/"Verify a vote") on the home page
      expect(screen.getAllByRole('link', { name: /verify/i }).length).toBeGreaterThan(0);
      // Public audit may have multiple links
      expect(screen.getAllByRole('link', { name: /public audit/i }).length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
    });

    it('renders brand/logo link', () => {
      render(<App />, { wrapper: BrowserRouter });
      
      const brandLink = screen.getByRole('link', { name: /verity/i });
      expect(brandLink).toBeInTheDocument();
      expect(brandLink).toHaveAttribute('href', '/');
    });

    it('navigates to home page by default', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );
      
      expect(screen.getByText(/elections that prove themselves/i)).toBeInTheDocument();
    });

    it('navigates to elections page', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: BrowserRouter });
      
      await user.click(screen.getByRole('link', { name: /^elections$/i }));
      expect(window.location.pathname).toBe('/elections');
    });

    it('navigates to verify page', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: BrowserRouter });
      
      await user.click(screen.getByRole('link', { name: /^verify$/i }));
      expect(window.location.pathname).toBe('/verify');
    });

    it('navigates to audit page', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: BrowserRouter });
      
      await user.click(screen.getByRole('link', { name: /public audit/i }));
      expect(window.location.pathname).toBe('/audit');
    });

    it('navigates to login page', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: BrowserRouter });
      
      await user.click(screen.getByRole('link', { name: /login/i }));
      expect(window.location.pathname).toBe('/login');
    });
  });

  describe('Routing', () => {
    it('renders Home page for "/" route', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );
      
      expect(screen.getByText(/elections that prove themselves/i)).toBeInTheDocument();
    });

    it('renders Elections page for "/elections" route', async () => {
      render(
        <MemoryRouter initialEntries={['/elections']}>
          <App />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /elections/i })).toBeInTheDocument();
      });
    });

    it('renders Verify page for "/verify" route', () => {
      render(
        <MemoryRouter initialEntries={['/verify']}>
          <App />
        </MemoryRouter>
      );
      
      expect(screen.getByRole('heading', { name: /verify your vote/i })).toBeInTheDocument();
    });

    it('renders Audit page for "/audit" route', () => {
      render(
        <MemoryRouter initialEntries={['/audit']}>
          <App />
        </MemoryRouter>
      );
      
      expect(screen.getByRole('heading', { name: /public audit trail/i })).toBeInTheDocument();
    });

    it('renders Login page for "/login" route', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      );
      
      expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    });

    it('renders Register page for "/register" route', () => {
      render(
        <MemoryRouter initialEntries={['/register']}>
          <App />
        </MemoryRouter>
      );
      
      expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument();
    });

    it('renders Vote page for "/vote/:electionId" route', () => {
      render(
        <MemoryRouter initialEntries={['/vote/test-election-123']}>
          <App />
        </MemoryRouter>
      );
      
      // Vote page shows loading initially while fetching election data
      expect(screen.getByText(/loading election/i)).toBeInTheDocument();
    });
  });

  describe('Layout Structure', () => {
    it('renders navigation container', () => {
      const { container } = render(<App />, { wrapper: BrowserRouter });
      
      expect(container.querySelector('.nav')).toBeInTheDocument();
    });

    it('renders app container', () => {
      const { container } = render(<App />, { wrapper: BrowserRouter });
      
      expect(container.querySelector('.app')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible navigation', () => {
      const { container } = render(<App />, { wrapper: BrowserRouter });
      
      expect(container.querySelector('nav')).toBeInTheDocument();
    });

    it('all navigation links are accessible via keyboard', async () => {
      render(<App />, { wrapper: BrowserRouter });
      
      const navLinks = screen.getAllByRole('link');
      
      for (const link of navLinks) {
        // Link should be a valid anchor element
        expect(link.tagName).toBe('A');
      }
    });
  });
});
