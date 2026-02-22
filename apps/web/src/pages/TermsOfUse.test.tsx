import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { TermsOfUse } from './TermsOfUse';

describe('TermsOfUse', () => {
  it('renders heading and owner details', () => {
    render(
      <MemoryRouter>
        <TermsOfUse />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /terms of use/i })).toBeInTheDocument();
    expect(screen.getByText(/ali bonagdaran/i)).toBeInTheDocument();
    expect(screen.getByText(/hello@ratemyunit\.dev/i)).toBeInTheDocument();
  });
});
