import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, MountId, ResolveAttempt, ResolveThread, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  discard: vi.fn(async (_params: { worktreePath: string; copyPath: string }) => undefined),
  setCopyPath: vi.fn(async (_params: unknown) => undefined),
}));

vi.mock('@goodboy/db', () => ({ setResolveAttemptCopyPath: h.setCopyPath }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/history/historyEngine', () => ({ discardHistoryCopy: h.discard }));

import { releaseEndedResolveCopies, releaseResolveCopy } from './releaseResolveCopy';

const attemptOf = (patch: Partial<ResolveAttempt>): ResolveAttempt => ({
  id: 'attempt-1',
  sessionId: 'session-1' as SessionId,
  agentId: 'agent-1' as AgentId,
  prNumber: 318,
  threadIds: ['PRRT_1'],
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  instructions: null,
  phase: 'finished',
  copyPath: '/copies/attempt-1',
  mountTarget: { mountId: 'mount-1' as MountId, mountRevision: 1, worktreePath: '/repo' },
  startedAt: 1,
  endedAt: 2,
  error: null,
  createdAt: 1,
  batchId: null,
  launchChoice: null,
  ...patch,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('releaseResolveCopy', () => {
  it('discards the copy and then forgets its path', async () => {
    await releaseResolveCopy({ attempt: attemptOf({}) });

    expect(h.discard).toHaveBeenCalledWith({
      worktreePath: '/repo',
      copyPath: '/copies/attempt-1',
    });
    expect(h.setCopyPath).toHaveBeenCalledWith({
      db: {},
      id: 'attempt-1',
      copyPath: null,
    });
  });

  it('keeps the path when the discard fails so the next pass can retry it', async () => {
    h.discard.mockRejectedValueOnce(new Error('busy'));

    await releaseResolveCopy({ attempt: attemptOf({}) });

    expect(h.setCopyPath).not.toHaveBeenCalled();
  });

  it('forgets the path of a copy that has no worktree to discard it from', async () => {
    await releaseResolveCopy({ attempt: attemptOf({ mountTarget: null }) });

    expect(h.discard).not.toHaveBeenCalled();
    expect(h.setCopyPath).toHaveBeenCalledOnce();
  });

  it('does nothing for an attempt without a copy', async () => {
    await releaseResolveCopy({ attempt: attemptOf({ copyPath: null }) });

    expect(h.discard).not.toHaveBeenCalled();
    expect(h.setCopyPath).not.toHaveBeenCalled();
  });
});

const rowOf = (patch: Partial<ResolveThread>): ResolveThread =>
  ({
    threadId: 'PRRT_1',
    state: 'fixed',
    activeAttemptId: 'attempt-1',
    ...patch,
  }) as ResolveThread;

describe('releaseEndedResolveCopies', () => {
  it('retries a failed discard on the next pass and leaves live attempts alone', async () => {
    const ended = attemptOf({});
    const live = attemptOf({
      id: 'attempt-2',
      agentId: 'agent-2' as AgentId,
      copyPath: '/copies/attempt-2',
      phase: 'running',
    });
    h.discard.mockRejectedValueOnce(new Error('busy'));

    await releaseEndedResolveCopies({ attempts: [ended, live], rows: [] });
    expect(h.setCopyPath).not.toHaveBeenCalled();

    await releaseEndedResolveCopies({ attempts: [ended, live], rows: [] });
    expect(h.discard).toHaveBeenCalledTimes(2);
    expect(h.discard).toHaveBeenLastCalledWith({
      worktreePath: '/repo',
      copyPath: '/copies/attempt-1',
    });
    expect(h.setCopyPath).toHaveBeenCalledOnce();
  });

  it('keeps the copy of a run whose agent still waits for an answer', async () => {
    const ended = attemptOf({ launchId: 'launch-1', phase: 'waiting' });

    const released = await releaseEndedResolveCopies({
      attempts: [ended],
      rows: [rowOf({ state: 'needs_answer' })],
    });

    expect(released).toBe(false);
    expect(h.discard).not.toHaveBeenCalled();
  });

  it('keeps the copy while a later turn of the same run is working in it', async () => {
    const first = attemptOf({ launchId: 'launch-1' });
    const second = attemptOf({
      id: 'attempt-2',
      launchId: 'launch-1',
      phase: 'running',
      copyPath: '/copies/attempt-1',
    });

    const released = await releaseEndedResolveCopies({ attempts: [first, second], rows: [] });

    expect(released).toBe(false);
    expect(h.discard).not.toHaveBeenCalled();
  });

  it('releases a copy shared by the turns of one run once, and forgets it on every turn', async () => {
    const first = attemptOf({ launchId: 'launch-1' });
    const second = attemptOf({ id: 'attempt-2', launchId: 'launch-1' });

    const released = await releaseEndedResolveCopies({
      attempts: [first, second],
      rows: [rowOf({ state: 'fixed' })],
    });

    expect(released).toBe(true);
    expect(h.discard).toHaveBeenCalledOnce();
    expect(h.setCopyPath.mock.calls.map((call) => call[0])).toEqual([
      { db: {}, id: 'attempt-1', copyPath: null },
      { db: {}, id: 'attempt-2', copyPath: null },
    ]);
  });
});
