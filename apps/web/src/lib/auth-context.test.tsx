import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from './api';
import { AuthProvider, useAuth } from './auth-context';

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;

const mockUser = {
  id: 'user-1',
  email: 'test@uts.edu.au',
  displayName: 'Test User',
  role: 'student',
  emailVerified: true,
};

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthProvider & useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches user on mount', async () => {
    mockGet.mockResolvedValue({ user: mockUser });

    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/auth/me');
    });
  });

  it('sets user after successful fetch', async () => {
    mockGet.mockResolvedValue({ user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
  });

  it('sets user to null when fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('Not authenticated'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });

  it('starts in loading state', () => {
    mockGet.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('login calls API and updates user', async () => {
    mockGet.mockRejectedValue(new Error('Not authenticated'));
    mockPost.mockResolvedValue({ user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.login('test@uts.edu.au', 'password123');
    });

    expect(mockPost).toHaveBeenCalledWith('/api/auth/login', {
      email: 'test@uts.edu.au',
      password: 'password123',
    });
    expect(result.current.user).toEqual(mockUser);
  });

  it('logout calls API and clears user', async () => {
    mockGet.mockResolvedValue({ user: mockUser });
    mockPost.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(mockPost).toHaveBeenCalledWith('/api/auth/logout');
    expect(result.current.user).toBeNull();
  });

  it('register calls API with correct params', async () => {
    mockGet.mockRejectedValue(new Error('Not authenticated'));
    mockPost.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.register(
        'test@uts.edu.au',
        'password123',
        'Test User',
        'uni-1',
      );
    });

    expect(mockPost).toHaveBeenCalledWith('/api/auth/register', {
      email: 'test@uts.edu.au',
      password: 'password123',
      displayName: 'Test User',
      universityId: 'uni-1',
    });
  });

  it('refetch re-fetches user and updates state', async () => {
    mockGet.mockResolvedValueOnce({ user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    const updatedUser = { ...mockUser, displayName: 'Updated Name' };
    mockGet.mockResolvedValueOnce({ user: updatedUser });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.user).toEqual(updatedUser);
    expect(result.current.loading).toBe(false);
  });

  it('useAuth throws when used outside AuthProvider', () => {
    // Suppress console.error from React during this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    spy.mockRestore();
  });
});
