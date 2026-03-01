import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';
import { Layout } from './Layout';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockApiGet = api.get as ReturnType<typeof vi.fn>;

function renderLayout(
  user: Record<string, unknown> | null = null,
  banner = { enabled: false, enforceEduAuEmail: false, message: '', palette: 'primary' }
) {
  const logout = vi.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ user, logout });
  mockApiGet.mockResolvedValue(banner);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<div>Home Content</div>} />
            </Route>
            <Route path="/login" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    ),
    logout,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Layout', () => {
  it('renders header with logo linking to "/"', () => {
    renderLayout();
    const logo = screen.getByText('RateMyUnit');
    expect(logo.closest('a')).toHaveAttribute('href', '/');
  });

  it('shows login/register links when not authenticated', () => {
    renderLayout(null);
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
  });

  it('shows logout when authenticated', () => {
    renderLayout({ id: '1', email: 'test@test.com', displayName: 'Test User', role: 'student' });
    expect(screen.getByText('Logout')).toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
  });

  it('shows admin link when user is admin', () => {
    renderLayout({ id: '1', email: 'admin@test.com', displayName: 'Admin', role: 'admin' });
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('does not show admin link for non-admin', () => {
    renderLayout({ id: '1', email: 'test@test.com', displayName: 'Student', role: 'student' });
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('logout button calls logout', async () => {
    const { logout } = renderLayout({ id: '1', email: 'test@test.com', displayName: 'Test', role: 'student' });
    await act(async () => {
      fireEvent.click(screen.getByText('Logout'));
    });
    expect(logout).toHaveBeenCalled();
  });

  it('footer renders with current year', () => {
    renderLayout();
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });

  it('footer includes privacy and terms links', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /terms of use/i })).toHaveAttribute('href', '/terms');
  });

  it('renders outlet content', () => {
    renderLayout();
    expect(screen.getByText('Home Content')).toBeInTheDocument();
  });

  it('renders site-wide banner when enabled', async () => {
    renderLayout(null, {
      enabled: true,
      enforceEduAuEmail: false,
      message: 'Campus systems maintenance tonight from 11PM.',
      palette: 'secondary',
    });

    await waitFor(() => {
      expect(screen.getByText('Campus systems maintenance tonight from 11PM.')).toBeInTheDocument();
    });
  });
});
