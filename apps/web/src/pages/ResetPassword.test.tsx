import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: vi.fn(),
  };
});

vi.mock('../lib/api', () => ({
  api: { post: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { ResetPassword } from './ResetPassword';

const mockUseSearchParams = useSearchParams as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;

function renderPage(token: string | null = 'valid-token-uuid') {
  const searchParams = new URLSearchParams();
  if (token) searchParams.set('token', token);
  mockUseSearchParams.mockReturnValue([searchParams]);

  return render(
    <MemoryRouter>
      <ResetPassword />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ResetPassword', () => {
  it('shows invalid message when token is missing', () => {
    renderPage(null);
    expect(screen.getByText(/invalid link/i)).toBeInTheDocument();
  });

  it('shows password mismatch error', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  it('shows short password error', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('successful reset navigates to login', async () => {
    mockPost.mockResolvedValue({});
    renderPage();

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'newpassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('API error shows error message', async () => {
    mockPost.mockRejectedValue(new Error('Token expired'));
    renderPage();

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'newpassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText('Token expired')).toBeInTheDocument();
    });
  });
});
