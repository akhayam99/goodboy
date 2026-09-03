// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const worktreeStatus = vi.hoisted(() => vi.fn());

vi.mock('../../../worktree/worktree', () => ({ worktreeStatus }));

import { useWorktreeStatuses } from '.';

afterEach(() => {
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
});
