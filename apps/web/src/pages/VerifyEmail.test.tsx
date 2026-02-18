import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: vi.fn(),
  };
});

vi.mock('../lib/api', () => ({
  api: { post: vi.fn() },
}));

import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { VerifyEmail } from './VerifyEmail';

const mockUseSearchParams = useSearchParams as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;

function renderPage(token: string | null = 'valid-token') {
  const searchParams = new URLSearchParams();
  if (token) searchParams.set('token', token);
  mockUseSearchParams.mockReturnValue([searchParams]);

  return render(
    <MemoryRouter>
      <VerifyEmail />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VerifyEmail', () => {
  it('auto-verifies on mount with token from URL', async () => {
    mockPost.mockResolvedValue({});
    renderPage('my-token');

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/auth/verify-email', { token: 'my-token' });
    });
  });

  it('shows success state and login link', async () => {
    mockPost.mockResolvedValue({});
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/email verified/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/go to login/i).closest('a')).toHaveAttribute('href', '/login');
  });

  it('shows error state and register link', async () => {
    mockPost.mockRejectedValue(new Error('Invalid token'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/create new account/i).closest('a')).toHaveAttribute('href', '/register');
  });

  it('shows loading during verification', () => {
    mockPost.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByText(/verifying email/i)).toBeInTheDocument();
  });

  it('shows error when token is missing', async () => {
    renderPage(null);

    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
    });
  });
});
