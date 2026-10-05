// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, MountId, ProjectId, ResolveAttempt, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  attempts: [] as Array<ResolveAttempt>,
  status: vi.fn(async (_params: { worktreePath: string }) => ({ head: 'base-sha' })),
  prepare: vi.fn(async (_params: { worktreePath: string; attemptId: string }) => ({
    copyPath: '/copies/fresh',
    head: 'live-head',
  })),
}));

vi.mock('@goodboy/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/db')>()),
  listResolveAttempts: async () => h.attempts,
}));
vi.mock('../../../features/worktree/worktree', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../features/worktree/worktree')>()),
  worktreeStatus: h.status,
  prepareResolveCopy: h.prepare,
}));

import { useAppStore } from '../../index';
import { resolverLaunchCopy } from './resolverLaunchCopy';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const MOUNT_ID = 'mount-1' as MountId;
const TARGET = { mountId: MOUNT_ID, mountRevision: 1, worktreePath: '/repos/payments-api' };

const resolver: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Resolve: 9 review comments',
  kind: 'resolver',
  status: 'completed',
};

const attemptOf = (patch: Partial<ResolveAttempt>): ResolveAttempt => ({
  id: 'attempt-1',
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  prNumber: 318,
  threadIds: ['PRRT_1'],
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: null,
  instructions: null,
  phase: 'waiting',
  mountTarget: TARGET,
  startedAt: 1,
  endedAt: 2,
  error: null,
  createdAt: 1,
  batchId: 'batch-1',
  launchId: 'launch-1',
  copyPath: '/copies/attempt-1',
  launchChoice: null,
  ...patch,
});

const getOf = ({ agent = resolver, revision = 1 }: { agent?: Agent; revision?: number } = {}) => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: [agent] },
    agentKindOverride: {},
    sessionProjectMounts: {
      [SESSION_ID]: [
        {
          mountId: MOUNT_ID,
          sessionId: SESSION_ID,
          projectId: 'project-1' as ProjectId,
          mountName: 'payments-api',
          worktreePath: TARGET.worktreePath,
          lastWorktreePath: null,
          repoRoot: '/repos/payments-api',
          branch: 'hl/fix-duplicate-credit',
          baseBranch: null,
          parallelIndex: 0,
          isAttached: true,
          diskState: 'present',
          revision,
        },
      ],
    },
  });
  return useAppStore.getState;
};

beforeEach(() => {
  h.attempts = [];
  h.status.mockClear().mockResolvedValue({ head: 'base-sha' });
  h.prepare.mockClear();
});

describe('resolverLaunchCopy', () => {
  it('hands a follow-up turn the copy the run already works in', async () => {
    h.attempts = [attemptOf({})];

    const copy = await resolverLaunchCopy({
      get: getOf(),
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    });

    expect(copy).toEqual({ copyPath: '/copies/attempt-1', mountTarget: TARGET });
    expect(h.prepare).not.toHaveBeenCalled();
  });

  it('takes the copy of the latest turn of the run', async () => {
    h.attempts = [
      attemptOf({ id: 'attempt-1', copyPath: '/copies/old' }),
      attemptOf({ id: 'attempt-2', copyPath: '/copies/attempt-2' }),
    ];

    const copy = await resolverLaunchCopy({
      get: getOf(),
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    });

    expect(copy?.copyPath).toBe('/copies/attempt-2');
  });

  it('makes a fresh copy of the branch when the run has none left, on the same mount', async () => {
    h.attempts = [attemptOf({ copyPath: null })];

    const copy = await resolverLaunchCopy({
      get: getOf(),
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    });

    expect(h.prepare).toHaveBeenCalledWith({
      worktreePath: TARGET.worktreePath,
      attemptId: 'attempt-1',
    });
    expect(copy).toEqual({ copyPath: '/copies/fresh', mountTarget: TARGET });
  });

  it('makes a fresh copy when the folder it remembers is gone', async () => {
    h.attempts = [attemptOf({})];
    h.status.mockRejectedValueOnce(new Error('missing'));

    const copy = await resolverLaunchCopy({
      get: getOf(),
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    });

    expect(copy?.copyPath).toBe('/copies/fresh');
  });

  it('still finds the mount after its revision moved on', async () => {
    h.attempts = [attemptOf({ copyPath: null })];

    const copy = await resolverLaunchCopy({
      get: getOf({ revision: 7 }),
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    });

    expect(copy?.copyPath).toBe('/copies/fresh');
  });

  it('leaves a resolver that never worked in a copy on the branch as it was', async () => {
    h.attempts = [attemptOf({ batchId: null, launchId: null, copyPath: null })];

    const copy = await resolverLaunchCopy({
      get: getOf(),
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    });

    expect(copy).toBeNull();
    expect(h.prepare).not.toHaveBeenCalled();
  });

  it('leaves every other kind of agent alone', async () => {
    h.attempts = [attemptOf({})];
    const planner: Agent = { ...resolver, name: 'Plan the retry budget', kind: 'planner' };

    const copy = await resolverLaunchCopy({
      get: getOf({ agent: planner }),
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    });

    expect(copy).toBeNull();
  });
});
