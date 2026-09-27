import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, SessionId } from '@goodboy/types';

type PushResult = { ok: true } | { ok: false; error: string };

const { state } = vi.hoisted(() => ({
  state: {
    pushSessionBranch: vi.fn(async (_params: unknown): Promise<PushResult> => ({ ok: true })),
    beginSessionCreation: vi.fn((_sessionId: string, _params: unknown) => 'creation-1'),
    endSessionCreation: vi.fn((_sessionId: string, _creationId: string) => undefined),
    reportError: vi.fn(async (_params: unknown) => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (store: typeof state) => T) => selector(state),
}));

import { usePushBranch } from './index';

const sessionId = 'session-1' as SessionId;
const mountId = 'mount-1' as MountId;

beforeEach(() => {
  state.pushSessionBranch.mockReset();
  state.pushSessionBranch.mockResolvedValue({ ok: true });
  state.beginSessionCreation.mockClear();
  state.endSessionCreation.mockClear();
  state.reportError.mockClear();
});

afterEach(cleanup);

describe('usePushBranch', () => {
  it('shows pending until the push settles, then clears it without a toast', async () => {
    let finish: (result: PushResult) => void = () => undefined;
    state.pushSessionBranch.mockImplementationOnce(
      () =>
        new Promise<PushResult>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => usePushBranch({ sessionId, mountId }));

    let outcome: Promise<boolean> = Promise.resolve(false);
    act(() => {
      outcome = result.current.run();
    });
    expect(result.current.isBusy).toBe(true);

    await act(async () => {
      finish({ ok: true });
      await outcome;
    });

    await expect(outcome).resolves.toBe(true);
    expect(result.current.isBusy).toBe(false);
    expect(state.pushSessionBranch).toHaveBeenCalledWith({ sessionId, mountId });
    expect(state.beginSessionCreation).toHaveBeenCalledWith(sessionId, {
      kind: 'branch',
      label: 'Pushing the branch',
    });
    expect(state.endSessionCreation).toHaveBeenCalledWith(sessionId, 'creation-1');
    expect(state.reportError).not.toHaveBeenCalled();
  });

  it('logs an unsuccessful push result once, with the git message', async () => {
    state.pushSessionBranch.mockResolvedValueOnce({
      ok: false,
      error: 'remote rejected the branch',
    });
    const { result } = renderHook(() => usePushBranch({ sessionId, mountId }));

    let outcome = true;
    await act(async () => {
      outcome = await result.current.run();
    });

    expect(outcome).toBe(false);
    expect(state.reportError).toHaveBeenCalledTimes(1);
    expect(state.reportError).toHaveBeenCalledWith({
      title: "Couldn't push the branch",
      error: new Error('remote rejected the branch'),
      sessionId,
    });
    expect(state.endSessionCreation).toHaveBeenCalledWith(sessionId, 'creation-1');
  });

  it('logs a rejected push', async () => {
    state.pushSessionBranch.mockRejectedValueOnce(new Error('network unavailable'));
    const { result } = renderHook(() => usePushBranch({ sessionId, mountId }));

    await act(async () => {
      await result.current.run();
    });

    expect(state.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ error: new Error('network unavailable') }),
    );
    expect(result.current.isBusy).toBe(false);
  });
});
