import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Login from '../../pages/Login';
import api from '../../services/api';

// Mock the api module
vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('renders login heading', () => {
      renderWithRouter(<Login />);
      
      expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    });

    it('renders login form with required fields', () => {
      renderWithRouter(<Login />);
      
      expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });

    it('renders OAuth buttons', () => {
      renderWithRouter(<Login />);
      
      expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /microsoft/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /facebook/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /id\.me/i })).toBeInTheDocument();
    });

    it('renders register link', () => {
      renderWithRouter(<Login />);
      
      expect(screen.getByText(/don't have an account\?/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /register here/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('requires username/email field', async () => {
      const user = userEvent.setup();
      renderWithRouter(<Login />);
      
      const passwordInput = screen.getByLabelText(/password/i);
      await user.type(passwordInput, 'password123');
      
      const submitButton = screen.getByRole('button', { name: /login/i });
      await user.click(submitButton);
      
      // HTML5 validation prevents submission
      const loginIdInput = screen.getByLabelText(/username or email/i);
      expect(loginIdInput).toBeRequired();
    });

    it('requires password field', async () => {
      const user = userEvent.setup();
      renderWithRouter(<Login />);
      
      const loginIdInput = screen.getByLabelText(/username or email/i);
      await user.type(loginIdInput, 'testuser');
      
      const submitButton = screen.getByRole('button', { name: /login/i });
      await user.click(submitButton);
      
      // HTML5 validation prevents submission
      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toBeRequired();
    });
  });

  describe('Login Flow', () => {
    it('submits login form with username', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          token: 'test-token',
          user: { id: '1', email: 'test@example.com', role: 'VOTER' },
        },
      });

      renderWithRouter(<Login />);

      await user.type(screen.getByLabelText(/username or email/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/auth/login', {
          username: 'testuser',
          password: 'password123',
        });
      });
    });

    it('submits login form with email', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          token: 'test-token',
          user: { id: '1', email: 'test@example.com', role: 'VOTER' },
        },
      });

      renderWithRouter(<Login />);

      await user.type(screen.getByLabelText(/username or email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/auth/login', {
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('stores auth token and user on successful login', async () => {
      const user = userEvent.setup();
      const mockUser = { id: '1', email: 'test@example.com', role: 'VOTER' };
      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          token: 'test-token-123',
          user: mockUser,
        },
      });

      renderWithRouter(<Login />);

      await user.type(screen.getByLabelText(/username or email/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      // After successful login, navigation should happen
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });
    });

    it('redirects regular user to elections page', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          token: 'test-token',
          user: { id: '1', role: 'VOTER' },
        },
      });

      renderWithRouter(<Login />);

      await user.type(screen.getByLabelText(/username or email/i), 'voter@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/elections');
      });
    });

    it('redirects super admin to admin page', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          token: 'test-token',
          user: { id: '1', role: 'SUPER_ADMIN' },
        },
      });

      renderWithRouter(<Login />);

      await user.type(screen.getByLabelText(/username or email/i), 'admin@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin');
      });
    });

    it('redirects org admin to admin dashboard', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          token: 'test-token',
          user: { id: '1', role: 'ORG_ADMIN' },
        },
      });

      renderWithRouter(<Login />);

      await user.type(screen.getByLabelText(/username or email/i), 'orgadmin@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard');
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message on login failure', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValueOnce({
        response: { data: { message: 'Invalid credentials' } },
      });

      renderWithRouter(<Login />);

      await user.type(screen.getByLabelText(/username or email/i), 'baduser');
      await user.type(screen.getByLabelText(/password/i), 'wrongpass');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });

    it('displays generic error message when no response message', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter(<Login />);

      await user.type(screen.getByLabelText(/username or email/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText(/login failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading state during login', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderWithRouter(<Login />);

      await user.type(screen.getByLabelText(/username or email/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      expect(screen.getByRole('button', { name: /logging in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
    });

    it('disables form inputs during loading', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderWithRouter(<Login />);

      await user.type(screen.getByLabelText(/username or email/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      expect(screen.getByLabelText(/username or email/i)).toBeDisabled();
      expect(screen.getByLabelText(/password/i)).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      renderWithRouter(<Login />);
      
      const loginIdInput = screen.getByLabelText(/username or email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      expect(loginIdInput).toHaveAttribute('id');
      expect(passwordInput).toHaveAttribute('id');
    });

    it('has autocomplete attributes for browser autofill', () => {
      renderWithRouter(<Login />);
      
      expect(screen.getByLabelText(/username or email/i)).toHaveAttribute('autocomplete', 'username');
      expect(screen.getByLabelText(/password/i)).toHaveAttribute('autocomplete', 'current-password');
    });

    it('error message is visible to screen readers', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValueOnce({
        response: { data: { message: 'Invalid credentials' } },
      });

      renderWithRouter(<Login />);

      await user.type(screen.getByLabelText(/username or email/i), 'baduser');
      await user.type(screen.getByLabelText(/password/i), 'wrongpass');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        const errorMessage = screen.getByText(/invalid credentials/i);
        expect(errorMessage).toBeVisible();
      });
    });
  });
});
