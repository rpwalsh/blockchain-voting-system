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

      expect(screen.getByRole('heading', { level: 1, name: /elections that prove themselves/i })).toBeInTheDocument();
    });

    it('renders tagline description', () => {
      renderWithRouter(<Home />);

      expect(screen.getByText(/cryptographically verifiable election platform/i)).toBeInTheDocument();
    });

    it('renders call-to-action buttons', () => {
      renderWithRouter(<Home />);

      expect(screen.getAllByRole('link', { name: /verify your vote/i }).length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: /view elections/i })).toBeInTheDocument();
    });

    it('view elections button links to elections page', () => {
      renderWithRouter(<Home />);

      const viewElections = screen.getByRole('link', { name: /view elections/i });
      expect(viewElections).toHaveAttribute('href', '/elections');
    });

    it('verify button links to verify page', () => {
      renderWithRouter(<Home />);

      const verifyLink = screen.getAllByRole('link', { name: /verify your vote/i })[0];
      expect(verifyLink).toHaveAttribute('href', '/verify');
    });
  });

  describe('Differentiator cards', () => {
    it('renders the Merkle audit trail differentiator', () => {
      renderWithRouter(<Home />);

      // Anchored: the hero subtitle also mentions "real Merkle audit trails" in
      // passing, so an unanchored match would hit both elements.
      expect(screen.getByText(/^real merkle audit trail$/i)).toBeInTheDocument();
    });

    it('renders the zero-knowledge eligibility differentiator', () => {
      renderWithRouter(<Home />);

      expect(screen.getByText(/anonymous eligibility, not just anonymous ballots/i)).toBeInTheDocument();
      expect(screen.getByText(/real groth16 zk-snark circuit/i)).toBeInTheDocument();
    });

    it('renders the homomorphic tally differentiator', () => {
      renderWithRouter(<Home />);

      expect(screen.getByText(/homomorphic tally, independently re-checkable/i)).toBeInTheDocument();
    });

    it('renders the external timestamp anchoring differentiator', () => {
      renderWithRouter(<Home />);

      // Anchored for the same reason as the Merkle card above.
      expect(screen.getByText(/^external timestamp anchoring$/i)).toBeInTheDocument();
      expect(screen.getAllByText(/opentimestamps/i).length).toBeGreaterThan(0);
    });

    it('renders the independent verifier differentiator', () => {
      renderWithRouter(<Home />);

      expect(screen.getByText(/verifiable without trusting us/i)).toBeInTheDocument();
    });

    it('renders the multi-party admin approval differentiator', () => {
      renderWithRouter(<Home />);

      expect(screen.getByText(/multi-party admin approval/i)).toBeInTheDocument();
    });
  });

  describe('How It Works Section', () => {
    it('renders section heading', () => {
      renderWithRouter(<Home />);

      expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument();
    });

    it('renders all four steps', () => {
      renderWithRouter(<Home />);

      expect(screen.getByText(/1\. anonymous enrollment/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. cast your vote/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. verify your vote/i)).toBeInTheDocument();
      expect(screen.getByText(/4\. tally & finalize/i)).toBeInTheDocument();
    });
  });

  describe('Audience CTA strip', () => {
    it('links to the integrity dashboard for admins', () => {
      renderWithRouter(<Home />);

      const link = screen.getByRole('link', { name: /open the integrity dashboard/i });
      expect(link).toHaveAttribute('href', '/admin/integrity');
    });

    it('public audit button links to audit page', () => {
      renderWithRouter(<Home />);

      const auditLink = screen.getByRole('link', { name: /public audit trail/i });
      expect(auditLink).toHaveAttribute('href', '/audit');
    });
  });

  describe('Honesty footer', () => {
    it('discloses no compliance certifications are held', () => {
      renderWithRouter(<Home />);

      expect(screen.getByText(/no fips 140-2, common criteria, soc 2, or iso 27001 certification/i)).toBeInTheDocument();
    });

    it('links to the whitepaper for the full breakdown', () => {
      renderWithRouter(<Home />);

      const whitepaperLinks = screen.getAllByRole('link', { name: /whitepaper/i });
      expect(whitepaperLinks.length).toBeGreaterThan(0);
      expect(whitepaperLinks[0]).toHaveAttribute('href', '/whitepaper');
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
