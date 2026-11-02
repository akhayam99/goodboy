// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startPoll } from './startPoll';

type VisibilityParams = {
  readonly state: 'visible' | 'hidden';
};

const setVisibility = ({ state }: VisibilityParams): void => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility({ state: 'visible' });
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setVisibility({ state: 'visible' });
});

describe('startPoll gates', () => {
  it('an always gate keeps ticking in a hidden and unfocused window', () => {
    setVisibility({ state: 'hidden' });
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const run = vi.fn();

    const stop = startPoll({ run, everyMs: 1000, gate: 'always', isImmediate: true });
    vi.advanceTimersByTime(3000);

    expect(run).toHaveBeenCalledTimes(4);
    stop();
  });

  it('an always gate stops when asked and leaves no timer behind', () => {
    const run = vi.fn();

    const stop = startPoll({ run, everyMs: 1000, gate: 'always', isImmediate: false });
    stop();
    vi.advanceTimersByTime(5000);

    expect(run).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a visible gate is quiet while hidden and unfocused windows count as visible', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const run = vi.fn();
    const stop = startPoll({ run, everyMs: 1000, gate: 'visible', isImmediate: false });

    vi.advanceTimersByTime(1000);
    expect(run).toHaveBeenCalledTimes(1);

    setVisibility({ state: 'hidden' });
    vi.advanceTimersByTime(10_000);
    expect(run).toHaveBeenCalledTimes(1);
    stop();
  });

  it('a focused gate is quiet in a visible window that is not focused', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const run = vi.fn();
    const stop = startPoll({ run, everyMs: 1000, gate: 'focused', isImmediate: false });

    vi.advanceTimersByTime(5000);

    expect(run).not.toHaveBeenCalled();
    stop();
  });
});
