import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';
import { ReviewForm } from './ReviewForm';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockApiGet = api.get as ReturnType<typeof vi.fn>;

function renderForm(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const defaultProps = {
    unitId: 'unit-1',
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
    ...props,
  };

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <ReviewForm {...defaultProps} />
      </QueryClientProvider>
    ),
    ...defaultProps,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApiGet.mockResolvedValue({
    enabled: false,
    enforceEduAuEmail: false,
    allowGuestReviews: false,
    message: '',
    palette: 'primary',
  });
});

describe('ReviewForm', () => {
  it('shows "login required" message when not authenticated', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderForm();
    expect(await screen.findByText(/please login to write a review/i)).toBeInTheDocument();
  });

  it('allows guest review when guest reviews are enabled', async () => {
    mockApiGet.mockResolvedValue({
      enabled: false,
      enforceEduAuEmail: false,
      allowGuestReviews: true,
      message: '',
      palette: 'primary',
    });
    mockUseAuth.mockReturnValue({ user: null });
    renderForm();

    expect(await screen.findByText(/write a review/i)).toBeInTheDocument();
    expect(screen.getByText(/guest user/i)).toBeInTheDocument();
  });

  it('renders form fields when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@uts.edu.au', emailVerified: true, domainVerified: true },
    });
    renderForm();
    expect(screen.getByText(/write a review/i)).toBeInTheDocument();
    expect(screen.getByText(/overall rating/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/session taken/i)).toBeInTheDocument();
  });

  it('shows error on submit without overall rating', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@uts.edu.au', emailVerified: true, domainVerified: true },
    });
    renderForm();

    fireEvent.change(screen.getByLabelText(/session taken/i), { target: { value: 'Autumn 2025' } });
    fireEvent.change(screen.getByPlaceholderText(/share your thoughts/i), {
      target: { value: 'A'.repeat(50) },
    });
    fireEvent.change(screen.getByPlaceholderText(/CoolStudent123/i), { target: { value: 'Nick' } });
    fireEvent.click(screen.getByText('Submit Review'));

    await waitFor(() => {
      expect(screen.getByText('Overall rating is required')).toBeInTheDocument();
    });
  });

  it('shows error for review text too short', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@uts.edu.au', emailVerified: true, domainVerified: true },
    });
    renderForm();

    // Click all 5 stars for overall rating
    const starButtons = screen.getAllByRole('button').filter(
      btn => !btn.textContent?.includes('Submit') && !btn.textContent?.includes('Cancel')
    );
    fireEvent.click(starButtons[4]); // 5th star in first group = overall rating

    fireEvent.change(screen.getByLabelText(/session taken/i), { target: { value: 'Autumn 2025' } });
    fireEvent.change(screen.getByPlaceholderText(/share your thoughts/i), {
      target: { value: 'Too short' },
    });
    fireEvent.change(screen.getByPlaceholderText(/CoolStudent123/i), { target: { value: 'Nick' } });
    fireEvent.click(screen.getByText('Submit Review'));

    await waitFor(() => {
      expect(screen.getByText(/at least 50 characters/i)).toBeInTheDocument();
    });
  });

  it('character count displays', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@uts.edu.au', emailVerified: true, domainVerified: true },
    });
    renderForm();
    expect(screen.getByText(/0 \/ 2000 characters/i)).toBeInTheDocument();
  });

  it('cancel button calls onCancel', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@uts.edu.au', emailVerified: true, domainVerified: true },
    });
    const { onCancel } = renderForm();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows nickname input when displayNameType is nickname', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@uts.edu.au', emailVerified: true, domainVerified: true },
    });
    renderForm();
    expect(screen.getByPlaceholderText(/CoolStudent123/i)).toBeInTheDocument();
  });
});
