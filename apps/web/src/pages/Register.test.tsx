import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockRegister = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ register: mockRegister }),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue([
      { id: 'uni-1', name: 'University of Technology Sydney' },
      { id: 'uni-2', name: 'University of Sydney' },
    ]),
  },
}));

import { Register } from './Register';

function renderPage() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Register', () => {
  it('fetches and displays universities in dropdown', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('University of Technology Sydney')).toBeInTheDocument();
    });
  });

  it('password mismatch shows error', async () => {
    renderPage();
    await waitFor(() => screen.getByText('University of Technology Sydney'));

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/university email/i), { target: { value: 'test@uts.edu.au' } });
    fireEvent.change(screen.getByLabelText(/^university$/i), { target: { value: 'uni-1' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  it('short password shows error', async () => {
    renderPage();
    await waitFor(() => screen.getByText('University of Technology Sydney'));

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/university email/i), { target: { value: 'test@uts.edu.au' } });
    fireEvent.change(screen.getByLabelText(/^university$/i), { target: { value: 'uni-1' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('short display name shows error', async () => {
    renderPage();
    await waitFor(() => screen.getByText('University of Technology Sydney'));

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText(/university email/i), { target: { value: 'test@uts.edu.au' } });
    fireEvent.change(screen.getByLabelText(/^university$/i), { target: { value: 'uni-1' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
    });
  });

  it('successful registration shows success message', async () => {
    mockRegister.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => screen.getByText('University of Technology Sydney'));

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/university email/i), { target: { value: 'test@uts.edu.au' } });
    fireEvent.change(screen.getByLabelText(/^university$/i), { target: { value: 'uni-1' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument();
    });
  });

  it('API error shows error message', async () => {
    mockRegister.mockRejectedValue(new Error('Email already exists'));
    renderPage();
    await waitFor(() => screen.getByText('University of Technology Sydney'));

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/university email/i), { target: { value: 'test@uts.edu.au' } });
    fireEvent.change(screen.getByLabelText(/^university$/i), { target: { value: 'uni-1' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });
  });

  it('success state shows "Go to Login" button', async () => {
    mockRegister.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => screen.getByText('University of Technology Sydney'));

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/university email/i), { target: { value: 'test@uts.edu.au' } });
    fireEvent.change(screen.getByLabelText(/^university$/i), { target: { value: 'uni-1' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/go to login/i)).toBeInTheDocument();
    });
  });
});
