import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ErrorBoundary } from './ErrorBoundary';

function ThrowingComponent({ error }: { error: Error }): React.ReactElement {
  throw error;
}

function GoodComponent() {
  return <div>Working fine</div>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Working fine')).toBeInTheDocument();
  });

  it('catches error and shows error message', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Test error message')} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('"Try again" button resets and re-renders children', () => {
    let shouldThrow = true;

    function ConditionalThrow() {
      if (shouldThrow) throw new Error('boom');
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Try again'));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('"Reload page" button calls window.location.reload', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('crash')} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Reload page'));
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('renders custom fallback prop instead of default UI', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent error={new Error('crash')} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('logs error to console.error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('logged error')} />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalled();
  });
});
