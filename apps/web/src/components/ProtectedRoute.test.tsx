import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../lib/auth-context';
import { ProtectedRoute } from './ProtectedRoute';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

function renderWithRouter(ui: React.ReactElement, initialEntries = ['/']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe('ProtectedRoute', () => {
  it('shows spinner when loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderWithRouter(
      <ProtectedRoute><div>Content</div></ProtectedRoute>
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('redirects to /login when no user', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderWithRouter(
      <ProtectedRoute><div>Content</div></ProtectedRoute>
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('shows Access Denied for non-admin with requireAdmin', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', role: 'student' },
      loading: false,
    });
    renderWithRouter(
      <ProtectedRoute requireAdmin><div>Admin Content</div></ProtectedRoute>
    );
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('renders children for admin with requireAdmin', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', role: 'admin' },
      loading: false,
    });
    renderWithRouter(
      <ProtectedRoute requireAdmin><div>Admin Content</div></ProtectedRoute>
    );
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('renders children for student without requireAdmin', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', role: 'student' },
      loading: false,
    });
    renderWithRouter(
      <ProtectedRoute><div>Student Content</div></ProtectedRoute>
    );
    expect(screen.getByText('Student Content')).toBeInTheDocument();
  });
});
