// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const worktreeStatus = vi.hoisted(() => vi.fn());

vi.mock('../../../worktree/worktree', () => ({ worktreeStatus }));

import {
  REFRESH_MS,
  ensure,
  readWorktreeStatus,
  resetWorktreeStatusCache,
  subscribe,
  worktreeStatusKey,
} from './cache';

const PATH = '/worktrees/api';
const KEY = worktreeStatusKey({ worktreePath: PATH, baseBranch: 'main' });

beforeEach(() => {
  worktreeStatus.mockReset();
  worktreeStatus.mockResolvedValue({ branch: 'ak/feat' });
});

afterEach(() => {
  resetWorktreeStatusCache();
  vi.useRealTimers();
});

describe('worktree status cache', () => {
  it('keys an entry by worktree path and base branch', () => {
    expect(worktreeStatusKey({ worktreePath: PATH, baseBranch: 'main' })).toBe(`${PATH} main`);
    expect(worktreeStatusKey({ worktreePath: PATH })).toBe(`${PATH} `);
  });

  it('runs one fetch for concurrent callers on the same key', async () => {
    const [first, second] = await Promise.all([
      ensure({ key: KEY, worktreePath: PATH, baseBranch: 'main', maxAgeMs: 30_000 }),
      ensure({ key: KEY, worktreePath: PATH, baseBranch: 'main', maxAgeMs: 30_000 }),
    ]);

    expect(worktreeStatus).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ branch: 'ak/feat' });
    expect(second).toBe(first);
  });

  it('serves a fresh entry without touching the backend again', async () => {
    await ensure({ key: KEY, worktreePath: PATH, baseBranch: 'main', maxAgeMs: 30_000 });
    await ensure({ key: KEY, worktreePath: PATH, baseBranch: 'main', maxAgeMs: 30_000 });

    expect(worktreeStatus).toHaveBeenCalledTimes(1);
  });

  it('refetches once the entry is older than the caller window', async () => {
    await ensure({ key: KEY, worktreePath: PATH, baseBranch: 'main', maxAgeMs: 30_000 });
    await ensure({ key: KEY, worktreePath: PATH, baseBranch: 'main', maxAgeMs: 0 });

    expect(worktreeStatus).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed fetch out of the cache without throwing', async () => {
    worktreeStatus.mockRejectedValueOnce(new Error('no such worktree'));

    const value = await ensure({
      key: KEY,
      worktreePath: PATH,
      baseBranch: 'main',
      maxAgeMs: 30_000,
    });

    expect(value).toBeNull();
    expect(readWorktreeStatus(KEY)).toBeNull();
  });

  it('caps the fetches it runs at once', async () => {
    let running = 0;
    let peak = 0;
    const gates: Array<() => void> = [];
    worktreeStatus.mockImplementation(
      () =>
        new Promise((resolve) => {
          running += 1;
          peak = Math.max(peak, running);
          gates.push(() => {
            running -= 1;
            resolve({ branch: 'ak/feat' });
          });
        }),
    );

    const all = Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        ensure({
          key: `/worktrees/${index} main`,
          worktreePath: `/worktrees/${index}`,
          baseBranch: 'main',
          maxAgeMs: 30_000,
        }),
      ),
    );

    await vi.waitFor(() => expect(gates.length).toBe(4));
    expect(worktreeStatus).toHaveBeenCalledTimes(4);
    let settled = false;
    void all.then(() => {
      settled = true;
    });
    while (!settled) {
      gates.splice(0, gates.length).forEach((release) => release());
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await all;

    expect(peak).toBeLessThanOrEqual(4);
    expect(worktreeStatus).toHaveBeenCalledTimes(10);
  });

  it('refreshes only the keys that still have a subscriber', async () => {
    vi.useFakeTimers();
    await ensure({ key: KEY, worktreePath: PATH, baseBranch: 'main', maxAgeMs: 30_000 });
    const otherKey = worktreeStatusKey({ worktreePath: '/worktrees/web', baseBranch: 'main' });
    await ensure({
      key: otherKey,
      worktreePath: '/worktrees/web',
      baseBranch: 'main',
      maxAgeMs: 30_000,
    });
    worktreeStatus.mockClear();
    const unsubscribe = subscribe({ key: KEY, listener: () => undefined });

    await vi.advanceTimersByTimeAsync(REFRESH_MS + 10);

    expect(worktreeStatus).toHaveBeenCalledTimes(1);
    expect(worktreeStatus).toHaveBeenCalledWith({ worktreePath: PATH, baseBranch: 'main' });

    worktreeStatus.mockClear();
    unsubscribe();
    await vi.advanceTimersByTimeAsync(REFRESH_MS + 10);

    expect(worktreeStatus).not.toHaveBeenCalled();
  });

  it('notifies the subscribers of a key when its value lands', async () => {
    await ensure({ key: KEY, worktreePath: PATH, baseBranch: 'main', maxAgeMs: 30_000 });
    const listener = vi.fn();
    subscribe({ key: KEY, listener });

    await ensure({ key: KEY, worktreePath: PATH, baseBranch: 'main', maxAgeMs: 0 });

    expect(listener).toHaveBeenCalled();
  });

  it('forgets everything on reset', async () => {
    await ensure({ key: KEY, worktreePath: PATH, baseBranch: 'main', maxAgeMs: 30_000 });
    expect(readWorktreeStatus(KEY)).toEqual({ branch: 'ak/feat' });

    resetWorktreeStatusCache();

    expect(readWorktreeStatus(KEY)).toBeNull();
    await ensure({ key: KEY, worktreePath: PATH, baseBranch: 'main', maxAgeMs: 30_000 });
    expect(worktreeStatus).toHaveBeenCalledTimes(2);
  });
});
