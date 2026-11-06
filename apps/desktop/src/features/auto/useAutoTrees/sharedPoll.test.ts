// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { startSharedPoll } from './sharedPoll';

const HARBORLINE = brandId<SessionId>({ value: 'session-harborline' });

type VisibilityParams = {
  readonly state: 'visible' | 'hidden';
};

const setVisibility = ({ state }: VisibilityParams): void => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
};

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility({ state: 'visible' });
});

afterEach(() => {
  vi.useRealTimers();
  setVisibility({ state: 'visible' });
});

describe('startSharedPoll', () => {
  it('reads every 2 seconds while the window shows', () => {
    const load = vi.fn();
    const stop = startSharedPoll({ sessionId: HARBORLINE, load });

    vi.advanceTimersByTime(6000);

    expect(load).toHaveBeenCalledTimes(3);
    stop();
  });

  it('keeps reading every 10 seconds in a hidden window, so Auto still reaches the board', () => {
    setVisibility({ state: 'hidden' });
    const load = vi.fn();
    const stop = startSharedPoll({ sessionId: HARBORLINE, load });

    vi.advanceTimersByTime(20_000);

    expect(load).toHaveBeenCalledTimes(2);
    stop();
  });

  it('runs one read for two watchers of one session and stops with the last', () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = startSharedPoll({ sessionId: HARBORLINE, load: first });
    const stopSecond = startSharedPoll({ sessionId: HARBORLINE, load: second });

    vi.advanceTimersByTime(2000);
    stopFirst();
    vi.advanceTimersByTime(2000);
    stopSecond();
    vi.advanceTimersByTime(4000);

    expect([first.mock.calls.length, second.mock.calls.length]).toEqual([1, 1]);
  });
});
