// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { RelativeTime } from './index';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RelativeTime', () => {
  it('keeps counting while the row stays on screen', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-29T10:00:00Z'));
    const { container } = render(<RelativeTime iso="2026-09-29T09:59:30Z" />);
    expect(container.textContent).toBe('just now');
    act(() => {
      vi.advanceTimersByTime(4 * 60_000);
    });
    expect(container.textContent).toBe('4m ago');
  });

  it('carries the machine readable time and the given title', () => {
    const { container } = render(<RelativeTime iso="2026-09-29T09:59:30Z" title="Sep 29, 12:00" />);
    const element = container.querySelector('time');
    expect(element?.getAttribute('datetime')).toBe('2026-09-29T09:59:30Z');
    expect(element?.getAttribute('title')).toBe('Sep 29, 12:00');
  });
});
