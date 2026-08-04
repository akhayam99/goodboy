// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';

type PushResult = { ok: true } | { ok: false; error: string };

type ToastOptions = { readonly title?: string };

const { showToast, state } = vi.hoisted(() => ({
  showToast: vi.fn<(kind: string, message: string, opts?: ToastOptions) => void>(),
  state: {
    pushSessionBranch: vi.fn(async (): Promise<PushResult> => ({ ok: true })),
    beginSessionCreation: vi.fn(() => 'creation-1'),
    endSessionCreation: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));

import { usePushBranch } from './index';

const sessionId = 'session-1' as SessionId;

beforeEach(() => {
  state.pushSessionBranch.mockReset();
  state.pushSessionBranch.mockResolvedValue({ ok: true });
  state.beginSessionCreation.mockReset();
  state.beginSessionCreation.mockReturnValue('creation-1');
  state.endSessionCreation.mockReset();
  showToast.mockClear();
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

  it('confirms the start and the end of a successful push in place', async () => {
    const { result } = renderHook(() => usePushBranch({ sessionId }));

    await act(() => result.current.run());

    expect(showToast.mock.calls.map((call) => call[2]?.title)).toEqual([
      'Push started',
      'Push done',
    ]);
    expect(state.beginSessionCreation).toHaveBeenCalledWith(sessionId, {
      kind: 'branch',
      label: 'Pushing the branch',
    });
    expect(state.endSessionCreation).toHaveBeenCalledWith(sessionId, 'creation-1');
  });

  it('surfaces an unsuccessful push result', async () => {
    state.pushSessionBranch.mockResolvedValueOnce({
      ok: false,
      error: 'remote rejected the branch',
    });
    const { result } = renderHook(() => usePushBranch({ sessionId }));

    await act(() => result.current.run());

    expect(result.current.error).toBe('remote rejected the branch');
    expect(showToast.mock.calls.map((call) => call[2]?.title)).toEqual(['Push started']);
    expect(state.endSessionCreation).toHaveBeenCalledWith(sessionId, 'creation-1');
  });

  it('surfaces a rejected push', async () => {
    state.pushSessionBranch.mockRejectedValueOnce(new Error('network unavailable'));
    const { result } = renderHook(() => usePushBranch({ sessionId }));

    await act(() => result.current.run());

    expect(result.current.error).toBe('network unavailable');
  });
});
