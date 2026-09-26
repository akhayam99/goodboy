import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, HistoryPlanArgs, MountId, SessionId } from '@goodboy/types';

const engine = vi.hoisted(() => ({
  readRebasePlan: vi.fn(),
  predictHistoryPlan: vi.fn(),
  tryHistoryPlan: vi.fn(),
  prepareHistoryRewrite: vi.fn(),
  collectHistoryRewrite: vi.fn(),
  applyHistoryPlan: vi.fn(),
  pushWithLease: vi.fn(),
  restoreHistoryBackup: vi.fn(),
}));

const worktree = vi.hoisted(() => ({
  worktreeStatus: vi.fn(async () => ({ upstream: 'origin/fix/ledger-postings', head: 'head-sha' })),
  worktreeRemoteHead: vi.fn(async () => 'remote-sha'),
}));

vi.mock('../../../features/history/historyEngine', () => engine);
vi.mock('../../../features/worktree/worktree', () => worktree);
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('@goodboy/db', () => ({
  listResolvePublicationsForSession: vi.fn(async () => []),
  setResolvePublicationPhase: vi.fn(async () => undefined),
  markHistoryPlan: vi.fn(async () => undefined),
}));
vi.mock('../../../features/session/components/AgentSpawnConfig/taskModelAgentSpawnConfig', () => ({
  taskModelAgentSpawnConfig: () => ({
    hint: '',
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
  }),
}));

import { createHistorySlice } from './index';
import { historyInitialState } from './state';
import { rewriterCopyFor } from './rewriterCopyFor';
import { rewriterKickoff } from './rewriterKickoff';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-ledger' as SessionId;
const MOUNT_ID = 'mount-ledger' as MountId;
const AGENT_ID = 'agent-rewriter' as AgentId;

const REBASE = {
  onto: 'onto-sha',
  ontoRef: 'origin/main',
  mergeBase: 'base-sha',
  head: 'head-sha',
  commits: [
    { sha: 'a1', subject: 'Guard the settlement batch' },
    { sha: 'b2', subject: 'Retry duplicate events' },
  ],
  behind: 18,
  fetchError: null,
};

const harness = () => {
  let state: Record<string, unknown> = {
    ...historyInitialState,
    sessions: [
      {
        id: SESSION_ID,
        workspaceId: 'workspace-harborline',
        providerPreference: { defaultProvider: 'anthropic' },
      },
    ],
    projects: [
      {
        id: 'project-ledger',
        name: 'ledger-core',
        workspaceId: 'workspace-harborline',
        baseBranch: 'main',
      },
    ],
    sessionProjectMounts: {
      [SESSION_ID]: [
        {
          mountId: MOUNT_ID,
          sessionId: SESSION_ID,
          projectId: 'project-ledger',
          mountName: 'ledger-core',
          worktreePath: '/w/ledger',
          branch: 'fix/ledger-postings',
          baseBranch: 'main',
          isAttached: true,
          diskState: 'present',
          revision: 1,
        },
      ],
    },
    sessionResolveThreads: {},
    workspaceOverrides: {},
    providerLimits: {},
    recordSessionEvent: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
    spawnAgent: vi.fn(async () => AGENT_ID),
    sendTurn: vi.fn(async () => ({ blockedOverBudget: false })),
    updateResolveThread: vi.fn(async () => true),
    refreshPrDescription: vi.fn(async () => false),
    loadHistoryDraft: vi.fn(async () => undefined),
  };
  const set = ((patch: unknown) => {
    const next =
      typeof patch === 'function'
        ? (patch as (s: Record<string, unknown>) => object)(state)
        : patch;
    state = { ...state, ...(next as object) };
  }) as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  const slice = createHistorySlice(set, get);
  state = { ...state, ...slice };
  return { slice, read: () => state as unknown as ReturnType<GetFn> };
};

beforeEach(() => {
  for (const mock of Object.values(engine)) {
    mock.mockReset();
  }
  engine.readRebasePlan.mockResolvedValue(REBASE);
  engine.applyHistoryPlan.mockResolvedValue({
    kind: 'moved',
    head: 'new-head',
    backupRef: 'refs/goodboy/backup/fix-ledger-postings/1',
  });
  engine.pushWithLease.mockResolvedValue({ kind: 'pushed' });
});

describe('rebase on main', () => {
  it('replays a clean rebase with the engine and never starts an agent', async () => {
    const { slice, read } = harness();
    engine.predictHistoryPlan.mockResolvedValue({
      isSupported: true,
      steps: [],
      head: 'predicted',
      isTreeEqual: false,
      changedFiles: [],
    });
    engine.tryHistoryPlan.mockResolvedValue({
      head: 'new-head',
      map: [{ from: 'a1', to: 'x1' }],
      isTreeEqual: false,
      changedFiles: [],
      stop: null,
      copyPath: null,
      order: [],
    });

    await expect(slice.rebaseBranch({ sessionId: SESSION_ID, mountId: MOUNT_ID })).resolves.toBe(
      'rebased',
    );

    expect(read().spawnAgent).not.toHaveBeenCalled();
    expect(engine.applyHistoryPlan).toHaveBeenCalledWith({
      worktreePath: '/w/ledger',
      branch: 'fix/ledger-postings',
      expectedHead: 'head-sha',
      newHead: 'new-head',
    });
    expect(engine.pushWithLease).toHaveBeenCalledWith(
      expect.objectContaining({ branch: 'fix/ledger-postings', expectedRemoteSha: 'remote-sha' }),
    );
    expect(read().historyRuns[MOUNT_ID]?.phase).toBe('pushed');
  });

  it('hands a predicted conflict to the hidden history rewriter working in a copy', async () => {
    const { slice, read } = harness();
    engine.predictHistoryPlan.mockResolvedValue({
      isSupported: true,
      steps: [{ sha: 'a1', outcome: 'conflict', files: ['src/ledger/postings.ts'], newSha: null }],
      head: null,
      isTreeEqual: false,
      changedFiles: [],
    });
    engine.prepareHistoryRewrite.mockResolvedValue({
      head: null,
      map: [],
      isTreeEqual: false,
      changedFiles: [],
      stop: { sha: 'a1', index: 0, kind: 'merge', files: ['src/ledger/postings.ts'], message: '' },
      copyPath: '/tmp/goodboy-history-copy',
      order: [
        { sha: 'a1', verb: 'pick', message: 'Guard the settlement batch' },
        { sha: 'b2', verb: 'pick', message: 'Retry duplicate events' },
      ],
    });

    await expect(slice.rebaseBranch({ sessionId: SESSION_ID, mountId: MOUNT_ID })).resolves.toBe(
      'rewriting',
    );

    expect(engine.tryHistoryPlan).not.toHaveBeenCalled();
    expect(read().spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ name: 'History rewriter', kindOverride: 'rewriter' }),
    );
    expect(read().spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.not.objectContaining({ mountId: expect.anything() }),
    );
    expect(
      rewriterCopyFor({ state: read(), sessionId: SESSION_ID, agentId: AGENT_ID })?.copyPath,
    ).toBe('/tmp/goodboy-history-copy');
    expect(read().historyRuns[MOUNT_ID]?.phase).toBe('rewriting');
    expect(read().sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: AGENT_ID,
        content: expect.stringContaining('postings.ts'),
      }),
    );
  });

  it('applies what the rewriter settled once the engine checks it out', async () => {
    const { slice, read } = harness();
    const plan: HistoryPlanArgs = {
      worktreePath: '/w/ledger',
      base: 'onto-sha',
      head: 'head-sha',
      steps: [{ sha: 'a1', verb: 'pick' }],
    };
    const state = read() as unknown as Record<string, unknown>;
    state['historyRewriters'] = {
      [AGENT_ID]: {
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        copyPath: '/tmp/goodboy-history-copy',
        plan,
        origin: 'rebase',
        planId: null,
      },
    };
    engine.collectHistoryRewrite.mockResolvedValue({
      head: 'rebuilt',
      map: [{ from: 'a1', to: 'rebuilt' }],
      problems: [],
      isTreeEqual: false,
      changedFiles: [],
    });

    await slice.settleHistoryRewriter({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: '<<history-step from="a1" to="c3">>\n<<history-done head="c3">>',
      hasFailed: false,
    });

    expect(engine.collectHistoryRewrite).toHaveBeenCalledWith(
      expect.objectContaining({ copyPath: '/tmp/goodboy-history-copy', skipped: [] }),
    );
    expect(engine.applyHistoryPlan).toHaveBeenCalledWith(
      expect.objectContaining({ newHead: 'rebuilt', expectedHead: 'head-sha' }),
    );
    expect(read().historyRewriters[AGENT_ID]).toBeUndefined();
  });

  it('stops and keeps the copy when the rewriter cannot merge with confidence', async () => {
    const { slice, read } = harness();
    const state = read() as unknown as Record<string, unknown>;
    state['historyRewriters'] = {
      [AGENT_ID]: {
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        copyPath: '/tmp/goodboy-history-copy',
        plan: { worktreePath: '/w/ledger', base: 'onto-sha', head: 'head-sha', steps: [] },
        origin: 'rebase',
        planId: null,
      },
    };

    await slice.settleHistoryRewriter({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText:
        '<<history-stuck from="a1" files="src/ledger/postings.ts" reason="both change the retry key">>',
      hasFailed: false,
    });

    expect(engine.collectHistoryRewrite).not.toHaveBeenCalled();
    expect(read().historyRuns[MOUNT_ID]?.stop).toEqual({
      reason: 'stuck',
      message: 'both change the retry key',
      files: ['src/ledger/postings.ts'],
      sha: 'a1',
    });
    expect(read().historyRewriters[AGENT_ID]).toBeDefined();
    expect(read().reportError).toHaveBeenCalled();
  });

  it('refuses to push over an origin that moved and says nothing was pushed', async () => {
    const { slice, read } = harness();
    engine.pushWithLease.mockResolvedValue({ kind: 'stale', message: 'stale info' });

    await expect(
      slice.applyHistoryRewrite({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        origin: 'plan',
        planId: 'plan-1',
        newHead: 'new-head',
        expectedHead: 'head-sha',
        map: [],
        shouldPush: true,
        byAgent: false,
      }),
    ).resolves.toBe('stopped');

    expect(read().historyRuns[MOUNT_ID]?.stop?.reason).toBe('origin-moved');
  });
});

describe('restore previous history', () => {
  it('moves the branch back to the backup and pushes it with the lease read before', async () => {
    const { slice, read } = harness();
    engine.restoreHistoryBackup.mockResolvedValue({
      kind: 'moved',
      head: 'old-head',
      backupRef: 'refs/goodboy/backup/fix-ledger-postings/2',
    });

    await expect(
      slice.restoreHistory({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        backupRef: 'refs/goodboy/backup/fix-ledger-postings/1',
        shouldPush: true,
      }),
    ).resolves.toBe('pushed');

    expect(engine.restoreHistoryBackup).toHaveBeenCalledWith({
      worktreePath: '/w/ledger',
      branch: 'fix/ledger-postings',
      expectedHead: 'head-sha',
      backupRef: 'refs/goodboy/backup/fix-ledger-postings/1',
    });
    expect(engine.pushWithLease).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRemoteSha: 'remote-sha' }),
    );
    expect(read().historyRuns[MOUNT_ID]?.phase).toBe('restored');
  });

  it('undoes a rewrite that never left this machine without pushing', async () => {
    const { slice } = harness();
    engine.restoreHistoryBackup.mockResolvedValue({
      kind: 'moved',
      head: 'old-head',
      backupRef: 'refs/goodboy/backup/fix-ledger-postings/2',
    });

    await expect(
      slice.restoreHistory({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        backupRef: 'refs/goodboy/backup/fix-ledger-postings/1',
        shouldPush: false,
      }),
    ).resolves.toBe('restored');
    expect(engine.pushWithLease).not.toHaveBeenCalled();
  });
});

describe('rewriterKickoff', () => {
  it('numbers the plan, names the stopped step and asks for markers on skips', () => {
    const text = rewriterKickoff({
      branch: 'fix/ledger-postings',
      base: 'onto-sha-1234567',
      copyPath: '/tmp/goodboy-history-copy',
      order: [
        { sha: 'a1', verb: 'pick', message: 'Guard the settlement batch' },
        { sha: 'b2', verb: 'squash', message: 'Guard the settlement batch\n\nRetry' },
      ],
      stop: { sha: 'b2', index: 1, kind: 'merge', files: ['src/ledger/postings.ts'], message: '' },
      note: 'keep the retry key from main',
    });

    expect(text).toContain('1. pick a1');
    expect(text).toContain('2. squash into the step above b2');
    expect(text).toContain('Step 2 (b2) stopped on a conflict in src/ledger/postings.ts');
    expect(text).toContain('to="none"');
    expect(text).toContain('keep the retry key from main');
  });
});
