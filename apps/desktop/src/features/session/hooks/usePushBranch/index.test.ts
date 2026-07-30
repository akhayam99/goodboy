// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';

type PushResult = { ok: true } | { ok: false; error: string };

const { state } = vi.hoisted(() => ({
  state: {
    pushSessionBranch: vi.fn(async (): Promise<PushResult> => ({ ok: true })),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (store: typeof state) => T) => selector(state),
}));

import { usePushBranch } from './index';

const sessionId = 'session-1' as SessionId;

beforeEach(() => {
  state.pushSessionBranch.mockReset();
  state.pushSessionBranch.mockResolvedValue({ ok: true });
});

afterEach(cleanup);

describe('usePushBranch', () => {
  it('pushes the session branch and clears the busy state', async () => {
    const { result } = renderHook(() => usePushBranch({ sessionId }));

    await act(() => result.current.run());

    expect(state.pushSessionBranch).toHaveBeenCalledWith(sessionId);
    expect(result.current.isBusy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('surfaces an unsuccessful push result', async () => {
    state.pushSessionBranch.mockResolvedValueOnce({
      ok: false,
      error: 'remote rejected the branch',
    });
    const { result } = renderHook(() => usePushBranch({ sessionId }));

    await act(() => result.current.run());

    expect(result.current.error).toBe('remote rejected the branch');
  });

  it('surfaces a rejected push', async () => {
    state.pushSessionBranch.mockRejectedValueOnce(new Error('network unavailable'));
    const { result } = renderHook(() => usePushBranch({ sessionId }));

    await act(() => result.current.run());

    expect(result.current.error).toBe('network unavailable');
  });
});
