// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const worktreeStatus = vi.hoisted(() => vi.fn());

vi.mock('../../../worktree/worktree', () => ({ worktreeStatus }));

import { resetWorktreeStatusCache } from './cache';
import { useWorktreeStatuses } from '.';

beforeEach(() => {
  worktreeStatus.mockReset();
});

afterEach(() => {
  resetWorktreeStatusCache();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useWorktreeStatuses', () => {
  it('keeps one stable empty state without scheduling a poll when no paths exist', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const targets: ReadonlyArray<{ worktreePath: string }> = [];
    const view = renderHook(() => useWorktreeStatuses({ targets }));
    const initialStatuses = view.result.current;

    view.rerender();

    expect(view.result.current).toBe(initialStatuses);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(worktreeStatus).not.toHaveBeenCalled();
  });

  it('fetches once when re-rendered with content-equal target arrays', async () => {
    worktreeStatus.mockResolvedValue({ mainDistance: 2 });
    const view = renderHook(
      ({ path }: { readonly path: string }) =>
        useWorktreeStatuses({ targets: [{ worktreePath: path, baseBranch: 'main' }] }),
      { initialProps: { path: '/tmp/worktree' } },
    );

    await waitFor(() => expect(view.result.current.size).toBe(1));
    const settledStatuses = view.result.current;

    view.rerender({ path: '/tmp/worktree' });
    view.rerender({ path: '/tmp/worktree' });

    expect(view.result.current).toBe(settledStatuses);
    expect(worktreeStatus).toHaveBeenCalledTimes(1);
  });

  it('serves two independent hook instances from one fetch per key', async () => {
    worktreeStatus.mockResolvedValue({ mainDistance: 2 });
    const targets = [{ worktreePath: '/tmp/worktree', baseBranch: 'main' }];

    const first = renderHook(() => useWorktreeStatuses({ targets }));
    const second = renderHook(() => useWorktreeStatuses({ targets }));

    await waitFor(() => expect(first.result.current.size).toBe(1));
    await waitFor(() => expect(second.result.current.size).toBe(1));

    expect(worktreeStatus).toHaveBeenCalledTimes(1);
    expect(first.result.current.get('/tmp/worktree')).toBe(
      second.result.current.get('/tmp/worktree'),
    );
  });

  it('reads a key another consumer already filled without fetching again', async () => {
    worktreeStatus.mockResolvedValue({ mainDistance: 2 });
    const targets = [{ worktreePath: '/tmp/worktree', baseBranch: 'main' }];
    const first = renderHook(() => useWorktreeStatuses({ targets }));
    await waitFor(() => expect(first.result.current.size).toBe(1));
    first.unmount();

    const second = renderHook(() => useWorktreeStatuses({ targets }));

    await waitFor(() => expect(second.result.current.size).toBe(1));
    expect(worktreeStatus).toHaveBeenCalledTimes(1);
  });

  it('leaves a failing worktree out of the map', async () => {
    worktreeStatus.mockRejectedValue(new Error('gone'));
    const targets = [{ worktreePath: '/tmp/gone', baseBranch: 'main' }];

    const view = renderHook(() => useWorktreeStatuses({ targets }));

    await waitFor(() => expect(worktreeStatus).toHaveBeenCalledTimes(1));
    expect(view.result.current.size).toBe(0);
  });
});
