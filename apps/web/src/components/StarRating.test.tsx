import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarRating } from './StarRating';

describe('StarRating', () => {
  it('renders correct number of stars (default 5)', () => {
    render(<StarRating value={3} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });

  it('renders custom number of stars', () => {
    render(<StarRating value={2} max={10} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(10);
  });

  it('calls onChange with correct value on click', () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[2]); // 3rd star
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('does not call onChange in readOnly mode', () => {
    const onChange = vi.fn();
    render(<StarRating value={3} onChange={onChange} readOnly />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables buttons in readOnly mode', () => {
    render(<StarRating value={3} readOnly />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach(btn => {
      expect(btn).toBeDisabled();
    });
  });

  it('buttons are enabled when not readOnly', () => {
    render(<StarRating value={3} onChange={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach(btn => {
      expect(btn).not.toBeDisabled();
    });
  });
});
