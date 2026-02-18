import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockLogin = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

import { Login } from './Login';

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Login', () => {
  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('successful login navigates to home', async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@uts.edu.au' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('invalid credentials shows error message', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'));
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@uts.edu.au' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });
  });

  it('"Forgot password?" link exists', () => {
    renderLogin();
    expect(screen.getByText(/forgot password/i)).toHaveAttribute('href', '/forgot-password');
  });

  it('"Sign up" link exists', () => {
    renderLogin();
    expect(screen.getByText('Sign up')).toHaveAttribute('href', '/register');
  });

  it('clears error on new submission attempt', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Bad credentials')).mockResolvedValueOnce(undefined);
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@uts.edu.au' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('Bad credentials')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.queryByText('Bad credentials')).not.toBeInTheDocument();
    });
  });
});
