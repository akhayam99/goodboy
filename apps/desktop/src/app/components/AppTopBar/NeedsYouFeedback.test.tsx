// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { announceNeedsYou } from '../../../features/workspace/components/SessionSwitcher/announceNeedsYou';
import { NeedsYouFeedback } from './NeedsYouFeedback';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const status = (container: HTMLElement): HTMLElement => {
  const node = container.querySelector<HTMLElement>('[data-needs-you-feedback]');
  if (node === null) {
    throw new Error('no feedback line');
  }
  return node;
};

describe('the needs you feedback line of the top bar', () => {
  it('is empty until the key has something to say', () => {
    const { container } = render(<NeedsYouFeedback />);

    expect(status(container).textContent).toBe('');
    expect(status(container).getAttribute('role')).toBe('status');
  });

  it('says it, then goes away after two seconds', () => {
    const { container } = render(<NeedsYouFeedback />);

    act(() => {
      announceNeedsYou({ text: 'Nothing needs you in Harborline' });
    });
    expect(status(container).textContent).toBe('Nothing needs you in Harborline');

    act(() => {
      vi.advanceTimersByTime(1_999);
    });
    expect(status(container).textContent).toBe('Nothing needs you in Harborline');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(status(container).textContent).toBe('');
  });

  it('keeps the latest line for its own two seconds when another comes', () => {
    const { container } = render(<NeedsYouFeedback />);

    act(() => {
      announceNeedsYou({ text: 'This is the only one' });
      vi.advanceTimersByTime(1_500);
      announceNeedsYou({ text: 'Nothing needs you' });
      vi.advanceTimersByTime(1_500);
    });

    expect(status(container).textContent).toBe('Nothing needs you');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(status(container).textContent).toBe('');
  });

  it('ignores an event that carries no text', () => {
    const { container } = render(<NeedsYouFeedback />);

    act(() => {
      window.dispatchEvent(new CustomEvent('goodboy:needs-you-feedback', { detail: { n: 1 } }));
    });

    expect(status(container).textContent).toBe('');
  });

  it('stops listening once it is gone', () => {
    const { unmount } = render(<NeedsYouFeedback />);
    unmount();

    expect(() => announceNeedsYou({ text: 'No one hears this' })).not.toThrow();
  });
});
