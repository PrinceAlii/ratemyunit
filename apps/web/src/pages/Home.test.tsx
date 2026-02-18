import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import { HomePage } from './Home';

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HomePage', () => {
  it('renders hero text and search input', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search for a unit/i)).toBeInTheDocument();
  });

  it('typing in search and submitting navigates to /browse', () => {
    renderHome();
    const input = screen.getByPlaceholderText(/Search for a unit/i);
    fireEvent.change(input, { target: { value: '31251' } });
    fireEvent.submit(input.closest('form')!);
    expect(mockNavigate).toHaveBeenCalledWith('/browse?q=31251');
  });

  it('empty search does not navigate', () => {
    renderHome();
    const input = screen.getByPlaceholderText(/Search for a unit/i);
    fireEvent.submit(input.closest('form')!);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('"Or browse all units" button navigates to /browse', () => {
    renderHome();
    const browseBtn = screen.getByText(/browse all units/i);
    fireEvent.click(browseBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/browse');
  });

  it('renders feature cards', () => {
    renderHome();
    expect(screen.getByText('Anonymous Reviews')).toBeInTheDocument();
    expect(screen.getByText('Detailed Ratings')).toBeInTheDocument();
    expect(screen.getByText('Verified Students')).toBeInTheDocument();
  });
});
