import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, MountId, ResolveAttempt, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  discard: vi.fn(async (_params: { worktreePath: string; copyPath: string }) => undefined),
  setCopyPath: vi.fn(async () => undefined),
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

describe('releaseEndedResolveCopies', () => {
  it('retries a failed discard on the next pass and leaves live attempts alone', async () => {
    const ended = attemptOf({});
    const live = attemptOf({ id: 'attempt-2', phase: 'running' });
    h.discard.mockRejectedValueOnce(new Error('busy'));

    await releaseEndedResolveCopies({ attempts: [ended, live] });
    expect(h.setCopyPath).not.toHaveBeenCalled();

    await releaseEndedResolveCopies({ attempts: [ended, live] });
    expect(h.discard).toHaveBeenCalledTimes(2);
    expect(h.setCopyPath).toHaveBeenCalledOnce();
  });
});
