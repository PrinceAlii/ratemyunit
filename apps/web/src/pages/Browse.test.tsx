import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/api', () => ({
  api: { get: vi.fn() },
}));

import { api } from '../lib/api';
import { BrowsePage } from './Browse';

const mockGet = api.get as ReturnType<typeof vi.fn>;

const mockUnits = [
  {
    id: 'u1',
    unitCode: '31251',
    unitName: 'Data Structures',
    description: 'Learn about DS.',
    faculty: 'FEIT',
    creditPoints: 6,
    universityAbbr: 'UTS',
    averageRating: 4.2,
    reviewCount: 10,
  },
  {
    id: 'u2',
    unitCode: '48024',
    unitName: 'Applications Programming',
    description: 'Java programming.',
    faculty: 'FEIT',
    creditPoints: 6,
    universityAbbr: 'UTS',
    averageRating: 3.8,
    reviewCount: 5,
  },
];

function renderPage(initialEntries = ['/browse']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <BrowsePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: return units for search and universities/faculties for filters
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/api/units/search')) {
      return Promise.resolve({
        data: mockUnits,
        pagination: { total: 2, limit: 20, offset: 0, page: 1, totalPages: 1 },
      });
    }
    if (url.includes('/api/public/universities')) {
      return Promise.resolve([{ id: 'uni-1', name: 'UTS' }]);
    }
    if (url.includes('/api/public/faculties')) {
      return Promise.resolve(['FEIT', 'Business']);
    }
    return Promise.resolve([]);
  });
});

describe('BrowsePage', () => {
  it('renders search input and filter controls', async () => {
    renderPage();
    expect(screen.getByPlaceholderText(/search by code/i)).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('shows loading skeletons while fetching', () => {
    mockGet.mockImplementation(() => new Promise(() => {})); // never resolves
    renderPage();
    // Skeletons are rendered as divs with specific class names
    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('displays units after loading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('31251')).toBeInTheDocument();
      expect(screen.getByText('Data Structures')).toBeInTheDocument();
    });
  });

  it('shows "No units found" for empty results', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/units/search')) {
        return Promise.resolve({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0, page: 1, totalPages: 0 },
        });
      }
      if (url.includes('/api/public/universities')) return Promise.resolve([]);
      if (url.includes('/api/public/faculties')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No units found')).toBeInTheDocument();
    });
  });

  it('clicking unit card navigates to /units/:code', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('31251')).toBeInTheDocument();
    });

    const card = screen.getByText('Data Structures').closest('[class*="cursor-pointer"]');
    if (card) fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith('/units/31251');
  });

  it('sort dropdown renders options', async () => {
    renderPage();
    const sortSelect = screen.getByDisplayValue('Highest Rated');
    expect(sortSelect).toBeInTheDocument();
    expect(screen.getByText('Lowest Rated')).toBeInTheDocument();
    expect(screen.getByText('Most Reviewed')).toBeInTheDocument();
    expect(screen.getByText('Recently Added')).toBeInTheDocument();
  });

  it('shows result count badge', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/showing 1-2 of 2 units/i)).toBeInTheDocument();
    });
  });
});
