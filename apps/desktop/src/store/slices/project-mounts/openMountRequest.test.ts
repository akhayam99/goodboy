import { describe, expect, it, vi } from 'vitest';
import type { MountId, SessionId } from '@goodboy/types';
import { openMountRequest } from './openMountRequest';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const MOUNT_ID = 'mount-1' as MountId;

const harness = () => {
  const state = {
    setSessionActiveMount: vi.fn(async () => undefined),
    setSessionStudio: vi.fn(),
    openReviewTarget: vi.fn(async () => ({ kind: 'opened' as const })),
  };
  const get = vi.fn(() => state) as unknown as GetFn;
  const set = vi.fn() as unknown as SetFn;
  return { state, run: openMountRequest(set, get) };
};

describe('openMountRequest', () => {
  it('opens an existing github request in review, on the mount it belongs to', async () => {
    const { state, run } = harness();

    await run({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      provider: 'github',
      requestNumber: 12,
    });

    expect(state.openReviewTarget).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      destination: { kind: 'pull_request', mountId: MOUNT_ID, prNumber: 12 },
    });
    expect(state.setSessionStudio).not.toHaveBeenCalled();
  });

  it('opens review on the create mode when the mount carries no request yet', async () => {
    const { state, run } = harness();

    await run({ sessionId: SESSION_ID, mountId: MOUNT_ID, provider: 'github' });

    expect(state.openReviewTarget).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      destination: { kind: 'mount', mountId: MOUNT_ID },
      mode: 'create_pr',
    });
  });

  it('carries a thread to the review target', async () => {
    const { state, run } = harness();

    await run({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      provider: 'github',
      requestNumber: 12,
      threadId: 'PRRT_1',
    });

    expect(state.openReviewTarget).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      destination: { kind: 'thread', mountId: MOUNT_ID, prNumber: 12, threadId: 'PRRT_1' },
    });
  });

  it('hands the target outcome back to the caller', async () => {
    const { state, run } = harness();
    state.openReviewTarget.mockResolvedValueOnce({
      kind: 'unavailable',
      reason: 'no_mount',
    } as never);

    await expect(
      run({ sessionId: SESSION_ID, mountId: MOUNT_ID, provider: 'github', requestNumber: 12 }),
    ).resolves.toEqual({ kind: 'unavailable', reason: 'no_mount' });
  });

  it('keeps gitlab and bitbucket on their own mount scoped studios', async () => {
    const gitlab = harness();
    await gitlab.run({ sessionId: SESSION_ID, mountId: MOUNT_ID, provider: 'gitlab' });
    expect(gitlab.state.setSessionActiveMount).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
    });
    expect(gitlab.state.setSessionStudio).toHaveBeenCalledWith(SESSION_ID, {
      kind: 'mr',
      mountId: MOUNT_ID,
    });
    expect(gitlab.state.openReviewTarget).not.toHaveBeenCalled();

    const bitbucket = harness();
    await bitbucket.run({ sessionId: SESSION_ID, mountId: MOUNT_ID, provider: 'bitbucket' });
    expect(bitbucket.state.setSessionStudio).toHaveBeenCalledWith(SESSION_ID, {
      kind: 'bitbucket',
      mountId: MOUNT_ID,
    });
    expect(bitbucket.state.openReviewTarget).not.toHaveBeenCalled();
  });
});
