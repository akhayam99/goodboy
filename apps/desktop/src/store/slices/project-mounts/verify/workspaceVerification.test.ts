// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { workspaceVerification } from './workspaceVerification';

afterEach(() => {
  vi.useRealTimers();
});

describe('workspaceVerification', () => {
  it('lets a turn start at once when nothing is being verified', async () => {
    workspaceVerification.track({ promise: Promise.resolve() });

    await expect(workspaceVerification.settled()).resolves.toBeUndefined();
  });

  it('holds a turn start until the verification settles', async () => {
    let finish: () => void = () => undefined;
    workspaceVerification.track({
      promise: new Promise<void>((resolve) => {
        finish = resolve;
      }),
    });
    let isSettled = false;

    const waiting = workspaceVerification.settled().then(() => {
      isSettled = true;
    });
    await Promise.resolve();
    expect(isSettled).toBe(false);

    finish();
    await waiting;

    expect(isSettled).toBe(true);
  });

  it('stops waiting after five seconds when git never answers', async () => {
    vi.useFakeTimers();
    workspaceVerification.track({ promise: new Promise<void>(() => undefined) });
    let isSettled = false;

    const waiting = workspaceVerification.settled().then(() => {
      isSettled = true;
    });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(isSettled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await waiting;

    expect(isSettled).toBe(true);
  });

  it('keeps a failed verification from blocking turns', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    workspaceVerification.track({ promise: Promise.reject(new Error('git unavailable')) });

    await expect(workspaceVerification.settled()).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledWith('verify workspace worktrees failed', expect.any(Error));
    logged.mockRestore();
  });
});
