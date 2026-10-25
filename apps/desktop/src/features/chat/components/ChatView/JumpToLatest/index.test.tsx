// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { JumpToLatest } from './index';

afterEach(cleanup);

describe('JumpToLatest', () => {
  it('stays mounted while hidden, inert and out of the accessibility tree', () => {
    const { container } = render(<JumpToLatest isVisible={false} onJump={vi.fn()} />);

    const host = container.querySelector<HTMLElement>('[data-jump-to-latest]');
    expect(host).not.toBeNull();
    expect(host?.hasAttribute('inert')).toBe(true);
    expect(host?.getAttribute('aria-hidden')).toBe('true');
    expect(host?.getAttribute('data-visible')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull();
  });

  it('answers a click when visible and jumps once', () => {
    const onJump = vi.fn();
    const { container } = render(<JumpToLatest isVisible onJump={onJump} />);

    const host = container.querySelector<HTMLElement>('[data-jump-to-latest]');
    expect(host?.hasAttribute('inert')).toBe(false);
    expect(host?.getAttribute('data-visible')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }));
    expect(onJump).toHaveBeenCalledTimes(1);
  });

  it('keeps the same element across a hide and a show, so it fades instead of popping', () => {
    const { container, rerender } = render(<JumpToLatest isVisible onJump={vi.fn()} />);
    const before = container.querySelector('[data-jump-to-latest]');

    rerender(<JumpToLatest isVisible={false} onJump={vi.fn()} />);
    rerender(<JumpToLatest isVisible onJump={vi.fn()} />);

    expect(container.querySelector('[data-jump-to-latest]')).toBe(before);
  });
});
