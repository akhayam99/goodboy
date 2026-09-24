import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  rearmMountRecovery,
  resetMountRecoveryGuard,
  runMountRecoveryOnce,
} from './mountRecoveryGuard';

const SESSION_ID = 'sess-1' as never;

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  resetMountRecoveryGuard();
});

describe('runMountRecoveryOnce', () => {
  it('runs once, then blocks a second call for the same session while it settles', async () => {
    let calls = 0;
    const run = vi.fn(async () => {
      calls += 1;
    });

    runMountRecoveryOnce({ sessionId: SESSION_ID, run });
    runMountRecoveryOnce({ sessionId: SESSION_ID, run });
    await flushMicrotasks();

    expect(calls).toBe(1);
  });

  it('clears the running guard when run() rejects asynchronously', async () => {
    const failing = vi.fn(async () => {
      throw new Error('async failure');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    runMountRecoveryOnce({ sessionId: SESSION_ID, run: failing });
    await flushMicrotasks();

    const recovered = vi.fn(async () => undefined);
    runMountRecoveryOnce({ sessionId: SESSION_ID, run: recovered });
    await flushMicrotasks();

    expect(recovered).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('clears the running guard when run() throws synchronously', async () => {
    const throwsSync = vi.fn(() => {
      throw new Error('sync failure');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    runMountRecoveryOnce({ sessionId: SESSION_ID, run: throwsSync as never });
    await flushMicrotasks();

    const recovered = vi.fn(async () => undefined);
    runMountRecoveryOnce({ sessionId: SESSION_ID, run: recovered });
    await flushMicrotasks();

    expect(recovered).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});

describe('rearmMountRecovery', () => {
  it('lets the next call run after a settled recovery', async () => {
    const run = vi.fn(async () => undefined);
    runMountRecoveryOnce({ sessionId: SESSION_ID, run });
    await flushMicrotasks();

    rearmMountRecovery({ sessionId: SESSION_ID });
    runMountRecoveryOnce({ sessionId: SESSION_ID, run });
    await flushMicrotasks();

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('still dedupes a call made while recovery runs', async () => {
    let finish = (): void => undefined;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    runMountRecoveryOnce({ sessionId: SESSION_ID, run });
    await flushMicrotasks();

    rearmMountRecovery({ sessionId: SESSION_ID });
    runMountRecoveryOnce({ sessionId: SESSION_ID, run });
    expect(run).toHaveBeenCalledTimes(1);

    finish();
    await flushMicrotasks();
    runMountRecoveryOnce({ sessionId: SESSION_ID, run });
    await flushMicrotasks();

    expect(run).toHaveBeenCalledTimes(2);
  });
});
