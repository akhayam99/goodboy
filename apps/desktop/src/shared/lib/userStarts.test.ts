import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isUserStart, markUserStart } from './userStarts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('userStarts', () => {
  it('knows nothing about a key nobody marked', () => {
    expect(isUserStart({ key: 'run-never-marked' })).toBe(false);
  });

  it('keeps a marked key as a user start for 5 seconds, then forgets it', () => {
    markUserStart({ key: 'run-ledger-core' });

    expect(isUserStart({ key: 'run-ledger-core' })).toBe(true);
    vi.advanceTimersByTime(4_999);
    expect(isUserStart({ key: 'run-ledger-core' })).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isUserStart({ key: 'run-ledger-core' })).toBe(false);
  });

  it('tracks each key on its own clock', () => {
    markUserStart({ key: 'agent-first' });
    vi.advanceTimersByTime(3_000);
    markUserStart({ key: 'agent-second' });
    vi.advanceTimersByTime(2_500);

    expect(isUserStart({ key: 'agent-first' })).toBe(false);
    expect(isUserStart({ key: 'agent-second' })).toBe(true);
  });

  it('restarts the window when the same key is marked again', () => {
    markUserStart({ key: 'run-notify-relay' });
    vi.advanceTimersByTime(4_000);
    markUserStart({ key: 'run-notify-relay' });
    vi.advanceTimersByTime(4_000);

    expect(isUserStart({ key: 'run-notify-relay' })).toBe(true);
  });
});
