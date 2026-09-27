import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { ReportedError } from '../../../store/slices/notifications/reportedError';

const { reportError } = vi.hoisted(() => ({
  reportError: vi.fn(async (_params: unknown) => undefined),
}));

vi.mock('../../../store', () => ({
  useAppStore: <T>(selector: (state: { reportError: typeof reportError }) => T) =>
    selector({ reportError }),
}));

import { usePendingAction } from './index';

const SESSION_ID = 'session-harborline' as SessionId;

type Deferred = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
};

const deferred = (): Deferred => {
  let resolve: () => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  reportError.mockClear();
});

describe('usePendingAction', () => {
  it('marks the key pending until the task settles', async () => {
    const gate = deferred();
    const { result } = renderHook(() => usePendingAction({ sessionId: SESSION_ID }));

    let outcome: Promise<boolean> = Promise.resolve(false);
    act(() => {
      outcome = result.current.run({
        key: 'push',
        failureTitle: "Couldn't push the branch",
        task: () => gate.promise,
      });
    });
    expect(result.current.pendingKeys.has('push')).toBe(true);

    await act(async () => {
      gate.resolve();
      await outcome;
    });
    expect(result.current.pendingKeys.has('push')).toBe(false);
    await expect(outcome).resolves.toBe(true);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('ignores a second run of the same key while the first is in flight', async () => {
    const gate = deferred();
    const task = vi.fn(() => gate.promise);
    const { result } = renderHook(() => usePendingAction({ sessionId: SESSION_ID }));

    let second: Promise<boolean> = Promise.resolve(true);
    act(() => {
      void result.current.run({ key: 'merge', failureTitle: "Couldn't merge #12", task });
      second = result.current.run({ key: 'merge', failureTitle: "Couldn't merge #12", task });
    });

    await expect(second).resolves.toBe(false);
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => {
      gate.resolve();
    });
  });

  it('logs a failure once with the action title and the real message', async () => {
    const { result } = renderHook(() => usePendingAction({ sessionId: SESSION_ID }));

    let outcome = true;
    await act(async () => {
      outcome = await result.current.run({
        key: 'push',
        failureTitle: "Couldn't push the branch",
        task: async () => {
          throw new Error('rejected: non-fast-forward');
        },
      });
    });

    expect(outcome).toBe(false);
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith({
      title: "Couldn't push the branch",
      error: new Error('rejected: non-fast-forward'),
      sessionId: SESSION_ID,
    });
    expect(result.current.pendingKeys.size).toBe(0);
  });

  it('does not log again an error the store already logged', async () => {
    const { result } = renderHook(() => usePendingAction({ sessionId: SESSION_ID }));

    await act(async () => {
      await result.current.run({
        key: 'ready',
        failureTitle: "Couldn't mark #12 ready",
        task: async () => {
          throw new ReportedError('gh pr ready exited with 1');
        },
      });
    });

    expect(reportError).not.toHaveBeenCalled();
  });
});
