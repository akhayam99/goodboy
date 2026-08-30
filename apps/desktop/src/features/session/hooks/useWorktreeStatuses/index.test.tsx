// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const worktreeStatus = vi.hoisted(() => vi.fn());

vi.mock('../../../worktree/worktree', () => ({ worktreeStatus }));

import { useWorktreeStatuses } from '.';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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
});
