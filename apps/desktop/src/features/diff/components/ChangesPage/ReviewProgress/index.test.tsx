// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReviewProgress } from './index';

afterEach(() => {
  cleanup();
});

describe('ReviewProgress', () => {
  it('reads Viewed N of M and jumps to the next unviewed file from Next', () => {
    const onNext = vi.fn();
    render(<ReviewProgress viewedCount={1} total={4} onNext={onNext} />);

    screen.getByText('Viewed 1 of 4');
    const next = screen.getByRole('button', { name: 'Next unviewed file' });
    expect(next.textContent).toBe('Next');
    fireEvent.click(next);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('disables Next once every file is viewed', () => {
    render(<ReviewProgress viewedCount={4} total={4} onNext={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Next unviewed file' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('ends with the keyboard shortcuts button', () => {
    render(<ReviewProgress viewedCount={0} total={4} onNext={vi.fn()} />);

    const labels = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent);
    expect(labels).toEqual(['Next unviewed file', 'Keyboard shortcuts']);
  });
});
