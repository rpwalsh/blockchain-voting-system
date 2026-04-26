import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from '../../pages/Home';

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Home Page', () => {
  describe('Hero Section', () => {
    it('renders main heading', () => {
      renderWithRouter(<Home />);
      
      expect(screen.getByRole('heading', { level: 1, name: /trustless voting system/i })).toBeInTheDocument();
    });

    it('renders tagline description', () => {
      renderWithRouter(<Home />);
      
      expect(screen.getByText(/cryptographically secure, tamper-proof voting platform/i)).toBeInTheDocument();
    });

    it('renders call-to-action buttons', () => {
      renderWithRouter(<Home />);
      
      expect(screen.getByRole('link', { name: /watch live demo/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /view elections/i })).toBeInTheDocument();
    });

    it('view elections button links to elections page', () => {
      renderWithRouter(<Home />);
      
      const viewElections = screen.getByRole('link', { name: /view elections/i });
      expect(viewElections).toHaveAttribute('href', '/elections');
    });

    it('verify button links to verify page', () => {
      renderWithRouter(<Home />);
      
      const verifyLink = screen.getByRole('link', { name: /verify your vote/i });
      expect(verifyLink).toHaveAttribute('href', '/verify');
    });
  });

  describe('Feature Cards', () => {
    it('renders End-to-End Encryption feature', () => {
      renderWithRouter(<Home />);
      
      expect(screen.getByText(/end-to-end encryption/i)).toBeInTheDocument();
      expect(screen.getByText(/every vote is encrypted from the moment you cast it/i)).toBeInTheDocument();
    });

    it('renders Public Verifiability feature', () => {
      renderWithRouter(<Home />);
      
      // Multiple elements with this text exist - use getAllBy
      const elements = screen.getAllByText(/public verifiability/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('renders Zero-Knowledge Proofs feature', () => {
      renderWithRouter(<Home />);
      
      expect(screen.getByText(/zero-knowledge proofs/i)).toBeInTheDocument();
      expect(screen.getByText(/your voting eligibility is verified without revealing your identity/i)).toBeInTheDocument();
    });

    it('renders Immutable Audit Trail feature', () => {
      renderWithRouter(<Home />);
      
      expect(screen.getByText(/immutable audit trail/i)).toBeInTheDocument();
      expect(screen.getByText(/every action creates a signed, timestamped ledger entry/i)).toBeInTheDocument();
    });

    it('renders Anonymous Voting Tokens feature', () => {
      renderWithRouter(<Home />);
      
      expect(screen.getByText(/anonymous voting tokens/i)).toBeInTheDocument();
    });

    it('renders Merkle Tree Verification feature', () => {
      renderWithRouter(<Home />);
      
      expect(screen.getByText(/merkle tree verification/i)).toBeInTheDocument();
    });
  });

  describe('How It Works Section', () => {
    it('renders section heading', () => {
      renderWithRouter(<Home />);
      
      expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument();
    });

    it('renders all four steps', () => {
      renderWithRouter(<Home />);
      
      expect(screen.getByText(/1\. voter registration/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. cast your vote/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. verify your vote/i)).toBeInTheDocument();
      expect(screen.getByText(/4\. tallying & results/i)).toBeInTheDocument();
    });

    it('renders step descriptions', () => {
      renderWithRouter(<Home />);
      
      expect(screen.getByText(/register with your government id/i)).toBeInTheDocument();
      expect(screen.getByText(/use your voting token to cast an encrypted ballot/i)).toBeInTheDocument();
      expect(screen.getByText(/use your receipt hash to verify your vote/i)).toBeInTheDocument();
    });
  });

  describe('Security Guarantees Section', () => {
    it('renders section heading', () => {
      renderWithRouter(<Home />);
      
      expect(screen.getByRole('heading', { name: /security guarantees/i })).toBeInTheDocument();
    });

    it('renders all security guarantees', () => {
      renderWithRouter(<Home />);
      
      expect(screen.getByText(/voter anonymity/i)).toBeInTheDocument();
      expect(screen.getByText(/vote integrity/i)).toBeInTheDocument();
      // Public verifiability appears multiple times
      expect(screen.getAllByText(/public verifiability/i).length).toBeGreaterThan(0);
      // No single point of failure may appear in multiple places
      const noSinglePointElements = screen.getAllByText(/no single point of failure/i);
      expect(noSinglePointElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/coercion resistance/i)).toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    it('public audit button links to audit page', () => {
      renderWithRouter(<Home />);
      
      const auditLink = screen.getByRole('link', { name: /public audit trail/i });
      expect(auditLink).toHaveAttribute('href', '/audit');
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithRouter(<Home />);
      
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();
      
      const h2s = screen.getAllByRole('heading', { level: 2 });
      expect(h2s.length).toBeGreaterThan(0);
    });

    it('all links have accessible names', () => {
      renderWithRouter(<Home />);
      
      const links = screen.getAllByRole('link');
      links.forEach((link: HTMLElement) => {
        expect(link).toHaveAccessibleName();
      });
    });
  });
});
