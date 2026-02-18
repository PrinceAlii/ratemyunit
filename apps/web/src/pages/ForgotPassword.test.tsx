import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/api', () => ({
  api: { post: vi.fn() },
}));

import { api } from '../lib/api';
import { ForgotPassword } from './ForgotPassword';

const mockPost = api.post as ReturnType<typeof vi.fn>;

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ForgotPassword', () => {
  it('renders email input and submit button', () => {
    renderPage();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('successful submission shows confirmation message', async () => {
    mockPost.mockResolvedValue({});
    renderPage();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@uts.edu.au' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it('error shows error message', async () => {
    mockPost.mockRejectedValue(new Error('Something went wrong'));
    renderPage();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@uts.edu.au' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  it('"Back to Login" link works', () => {
    renderPage();
    expect(screen.getByText(/back to login/i)).toHaveAttribute('href', '/login');
  });
});
