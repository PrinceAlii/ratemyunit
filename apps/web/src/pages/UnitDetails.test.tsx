import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { UnitDetails } from './UnitDetails';

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

const mockUnit = {
  id: 'unit-1',
  unitCode: '31251',
  unitName: 'Data Structures and Algorithms',
  description: 'Learn about data structures.',
  faculty: 'FEIT',
  creditPoints: 6,
  university: { id: 'uni-1', name: 'UTS', abbreviation: 'UTS' },
};

const mockReviews = [
  {
    id: 'rev-1',
    sessionTaken: 'Autumn 2025',
    overallRating: 4,
    teachingQualityRating: 3,
    workloadRating: 4,
    difficultyRating: 3,
    usefulnessRating: 5,
    reviewText: 'Great unit overall. Loved it a lot.',
    wouldRecommend: true,
    createdAt: '2025-03-01T00:00:00Z',
    displayNameType: 'nickname',
    customNickname: 'TestNick',
    voteCount: 5,
    user: {
      displayName: 'TestNick',
      role: 'student',
      emailVerified: true,
      domainVerified: true,
      emailDomain: 'student.uts.edu.au',
    },
  },
];

function renderPage(unitCode = '31251') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/units/${unitCode}`]}>
        <Routes>
          <Route path="/units/:unitCode" element={<UnitDetails />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', email: 'test@uts.edu.au', role: 'student' },
  });
});

describe('UnitDetails', () => {
  it('shows loading skeleton while fetching', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    renderPage();
    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('loads and displays unit info', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/reviews')) return Promise.resolve(mockReviews);
      return Promise.resolve(mockUnit);
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('31251')).toBeInTheDocument();
      expect(screen.getByText('Data Structures and Algorithms')).toBeInTheDocument();
    });
  });

  it('renders reviews list', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/reviews')) return Promise.resolve(mockReviews);
      return Promise.resolve(mockUnit);
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/great unit overall/i)).toBeInTheDocument();
    });
  });

  it('shows "No reviews yet" for empty reviews', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/reviews')) return Promise.resolve([]);
      return Promise.resolve(mockUnit);
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
    });
  });

  it('shows 404 when unit not found', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/reviews')) return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
    renderPage('INVALID');

    await waitFor(() => {
      expect(screen.getByText(/unit not found/i)).toBeInTheDocument();
    });
  });

  it('shows "Write a Review" button', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/reviews')) return Promise.resolve(mockReviews);
      return Promise.resolve(mockUnit);
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Write a Review')).toBeInTheDocument();
    });
  });

  it('shows rating averages grid when reviews exist', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/reviews')) return Promise.resolve(mockReviews);
      return Promise.resolve(mockUnit);
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Overall')).toBeInTheDocument();
      expect(screen.getAllByText('Teaching').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Workload').length).toBeGreaterThan(0);
    });
  });

  it('displays credit points badge', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/reviews')) return Promise.resolve([]);
      return Promise.resolve(mockUnit);
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('6 CP')).toBeInTheDocument();
    });
  });
});
