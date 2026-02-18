import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerificationBadge } from './VerificationBadge';

describe('VerificationBadge', () => {
  it('shows "Verified university email" when domainVerified=true', () => {
    render(<VerificationBadge domainVerified={true} />);
    const badge = screen.getByLabelText('Verified university email');
    expect(badge).toBeInTheDocument();
  });

  it('shows "Verified .edu.au email" when domainVerified=false', () => {
    render(<VerificationBadge domainVerified={false} />);
    const badge = screen.getByLabelText('Verified .edu.au email');
    expect(badge).toBeInTheDocument();
  });

  it('renders the badge icon', () => {
    render(<VerificationBadge domainVerified={true} />);
    // BadgeCheck from lucide renders an SVG
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
