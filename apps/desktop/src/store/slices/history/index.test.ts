import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  BranchCommit,
  HistoryPlanArgs,
  HistoryStep,
  HistoryTrialProgress,
  MountId,
  ProjectId,
  SessionId,
} from '@goodboy/types';

const engine = vi.hoisted(() => ({
  readRebasePlan: vi.fn(),
  predictHistoryPlan: vi.fn(),
  tryHistoryPlan: vi.fn(),
  prepareHistoryRewrite: vi.fn(),
  collectHistoryRewrite: vi.fn(),
  applyHistoryPlan: vi.fn(),
  pushWithLease: vi.fn(),
  restoreHistoryBackup: vi.fn(),
  readOriginAhead: vi.fn(),
  runHistoryPlan: vi.fn(),
  readHistoryGraph: vi.fn(),
  readRemoteLease: vi.fn(),
  discardHistoryCopy: vi.fn(),
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
  saveDraftHistoryPlan: vi.fn(async () => ({ id: 'plan-1' })),
  getDraftHistoryPlan: vi.fn(async () => null),
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
const IDENTITY = {
  worktreePath: '/w/ledger',
  branch: 'fix/ledger-postings',
  projectId: 'project-ledger' as ProjectId,
};
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
    mountGithub: {},
    workspaceOverrides: {},
    providerLimits: {},
    recordSessionEvent: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
    spawnAgent: vi.fn(async () => AGENT_ID),
    sendTurn: vi.fn(async () => ({ blockedOverBudget: false })),
    updateResolveThread: vi.fn(async () => true),
    refreshPrDescription: vi.fn(async () => false),
    refreshSessionPr: vi.fn(async () => undefined),
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
  engine.readRemoteLease.mockResolvedValue({ kind: 'included', sha: 'remote-sha' });
  engine.discardHistoryCopy.mockResolvedValue(undefined);
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
    expect(read().refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, {
      mountId: MOUNT_ID,
      force: true,
      silent: true,
    });
  });

  it('refuses a rebase the check on the copy did not pass', async () => {
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
      map: [],
      isTreeEqual: false,
      changedFiles: [],
      stop: null,
      copyPath: null,
      order: [],
      check: {
        isPassed: false,
        expectsSameCode: false,
        problems: ['The result contains a merge commit.'],
        unexpectedFiles: [],
        removedFiles: [],
      },
    });

    await expect(slice.rebaseBranch({ sessionId: SESSION_ID, mountId: MOUNT_ID })).resolves.toBe(
      'stopped',
    );

    expect(engine.tryHistoryPlan).toHaveBeenCalledWith(
      expect.objectContaining({ base: 'base-sha', onto: 'onto-sha' }),
    );
    expect(read().historyRuns[MOUNT_ID]?.stop?.reason).toBe('unverified');
    expect(engine.applyHistoryPlan).not.toHaveBeenCalled();
  });

  it('never applies or pushes a replay whose check failed, even without a conflict', async () => {
    const { slice, read } = harness();
    engine.predictHistoryPlan.mockResolvedValue({
      isSupported: true,
      steps: [{ sha: 'a1', outcome: 'conflict', files: ['ledger.ts'], newSha: null }],
      head: null,
      isTreeEqual: false,
      changedFiles: [],
    });
    engine.prepareHistoryRewrite.mockResolvedValue({
      head: 'replayed-head',
      map: [],
      isTreeEqual: false,
      changedFiles: ['ledger.ts'],
      stop: null,
      copyPath: null,
      order: [],
      check: {
        isPassed: false,
        expectsSameCode: false,
        problems: ['The result differs from what the plan should make in 1 file: ledger.ts.'],
        unexpectedFiles: ['ledger.ts'],
        removedFiles: [],
      },
    });

    await expect(slice.rebaseBranch({ sessionId: SESSION_ID, mountId: MOUNT_ID })).resolves.toBe(
      'stopped',
    );
    expect(read().historyRuns[MOUNT_ID]?.stop?.reason).toBe('unverified');
    expect(engine.applyHistoryPlan).not.toHaveBeenCalled();
    expect(engine.pushWithLease).not.toHaveBeenCalled();

    await slice.startHistoryRewriter({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      plan: { worktreePath: '/w/ledger', base: 'base-sha', head: 'head-sha', steps: [] },
      origin: 'plan',
      planId: 'plan-1',
    });
    expect(read().historyRuns[MOUNT_ID]?.phase).toBe('stopped');
    expect(read().historyRuns[MOUNT_ID]?.result).toBeNull();
  });

  it('removes the conflicted copy when the rewriter cannot start or cannot be told', async () => {
    const { slice, read } = harness();
    engine.prepareHistoryRewrite.mockResolvedValue({
      head: null,
      map: [],
      isTreeEqual: false,
      changedFiles: [],
      stop: { sha: 'a1', index: 0, kind: 'merge', files: ['ledger.ts'], message: '' },
      copyPath: '/tmp/goodboy-history-copy',
      order: [],
      check: null,
    });
    const plan = { worktreePath: '/w/ledger', base: 'base-sha', head: 'head-sha', steps: [] };
    const spawn = read().spawnAgent as unknown as ReturnType<typeof vi.fn>;
    spawn.mockRejectedValueOnce(new Error('no room for another agent'));
    await slice.startHistoryRewriter({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      plan,
      origin: 'plan',
      planId: 'plan-1',
    });
    expect(engine.discardHistoryCopy).toHaveBeenCalledWith({
      worktreePath: '/w/ledger',
      copyPath: '/tmp/goodboy-history-copy',
    });
    const send = read().sendTurn as unknown as ReturnType<typeof vi.fn>;
    send.mockRejectedValueOnce(new Error('the provider is offline'));
    await slice.startHistoryRewriter({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      plan,
      origin: 'plan',
      planId: 'plan-1',
    });
    await vi.waitFor(() => expect(engine.discardHistoryCopy).toHaveBeenCalledTimes(2));
    expect(read().historyRewriters[AGENT_ID]).toBeUndefined();
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
        identity: IDENTITY,
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
        identity: IDENTITY,
      }),
    ).resolves.toBe('stopped');

    expect(read().historyRuns[MOUNT_ID]?.stop?.reason).toBe('origin-moved');
    expect(read().recordSessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'history_rewritten',
        payload: expect.objectContaining({ planId: 'plan-1', origin: 'plan' }),
      }),
    );
    expect(read().recordSessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'history_stopped',
        payload: expect.objectContaining({ reason: 'origin-moved', planId: 'plan-1' }),
      }),
    );
    expect(read().reportError).toHaveBeenCalledWith(
      expect.objectContaining({ action: { kind: 'open-activity', sessionId: SESSION_ID } }),
    );
  });
});

const PLAN_COMMITS: ReadonlyArray<BranchCommit> = [
  {
    sha: 'b2',
    shortSha: 'b2',
    subject: 'Retry duplicate events',
    author: 'Robin Vale',
    timestamp: 1_790_000_000,
    pushed: false,
    parentSha: 'a1',
  },
  {
    sha: 'a1',
    shortSha: 'a1',
    subject: 'Guard the settlement batch',
    author: 'Robin Vale',
    timestamp: 1_789_990_000,
    pushed: true,
    parentSha: 'base-sha',
  },
];

const PLAN_ITEMS: ReadonlyArray<HistoryStep> = [
  { sha: 'a1', verb: 'pick' },
  { sha: 'b2', verb: 'fixup', target: 'a1' },
];

const seedDraft = ({
  harnessed,
  onto = null,
}: {
  readonly harnessed: ReturnType<typeof harness>;
  readonly onto?: string | null;
}) => {
  const state = harnessed.read() as unknown as Record<string, unknown>;
  Object.assign(state, {
    historyDrafts: {
      [MOUNT_ID]: {
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        planId: 'plan-1',
        branch: 'fix/ledger-postings',
        baseSha: 'base-sha',
        headSha: 'head-sha',
        commits: PLAN_COMMITS,
        items: PLAN_ITEMS,
        onto,
        graph: null,
        undo: [],
        prediction: null,
        isPredicting: false,
        loadError: null,
      },
    },
  });
};

const TRIED = {
  head: 'new-head',
  map: [
    { from: 'a1', to: 'x1' },
    { from: 'b2', to: 'x1' },
  ],
  isTreeEqual: true,
  changedFiles: [],
  stop: null,
  copyPath: null,
  order: [],
  check: {
    isPassed: true,
    expectsSameCode: true,
    problems: [],
    unexpectedFiles: [],
    removedFiles: [],
  },
};

describe('apply a planned rewrite', () => {
  it('tries the plan on a copy step by step, then moves the branch with a backup', async () => {
    const harnessed = harness();
    seedDraft({ harnessed, onto: 'main-sha' });
    const seen: Array<HistoryTrialProgress | null | undefined> = [];
    engine.runHistoryPlan.mockImplementation(
      async ({ onProgress }: { onProgress: (progress: HistoryTrialProgress) => void }) => {
        expect(engine.applyHistoryPlan).not.toHaveBeenCalled();
        onProgress({ stage: 'step', index: 1, total: 2, sha: 'a1' });
        seen.push(harnessed.read().historyRuns[MOUNT_ID]?.progress);
        return { kind: 'tried', result: TRIED };
      },
    );

    await expect(
      harnessed.slice.applyHistoryDraft({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        shouldPush: false,
      }),
    ).resolves.toBe('applied');

    expect(engine.runHistoryPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: 'fix/ledger-postings',
        plan: expect.objectContaining({ base: 'base-sha', head: 'head-sha', onto: 'main-sha' }),
      }),
    );
    expect(seen).toEqual([{ stage: 'step', index: 1, total: 2, sha: 'a1' }]);
    expect(engine.applyHistoryPlan).toHaveBeenCalledWith({
      worktreePath: '/w/ledger',
      branch: 'fix/ledger-postings',
      expectedHead: 'head-sha',
      newHead: 'new-head',
    });
    const run = harnessed.read().historyRuns[MOUNT_ID];
    expect(run?.backupRef).toBe('refs/goodboy/backup/fix-ledger-postings/1');
    expect(run?.applied).toEqual(
      expect.objectContaining({
        before: 2,
        after: 1,
        includes: { x1: ['Retry duplicate events'] },
        lines: [
          {
            action: 'fixup',
            text: 'Folded “Retry duplicate events” into “Guard the settlement batch”, keeping its title',
          },
          { action: 'rebase', text: "Started the branch from today's main" },
        ],
      }),
    );
    expect(engine.pushWithLease).not.toHaveBeenCalled();
  });

  it('stops before the copy when the worktree is dirty and moves nothing', async () => {
    const harnessed = harness();
    seedDraft({ harnessed });
    engine.runHistoryPlan.mockResolvedValue({
      kind: 'blocked',
      reason: '2 files here have changes that are not committed.',
    });

    await expect(
      harnessed.slice.applyHistoryDraft({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        shouldPush: true,
      }),
    ).resolves.toBe('stopped');

    expect(harnessed.read().historyRuns[MOUNT_ID]?.stop).toEqual({
      reason: 'blocked',
      message: '2 files here have changes that are not committed.',
      files: [],
      sha: null,
    });
    expect(engine.applyHistoryPlan).not.toHaveBeenCalled();
  });

  it('names the step that conflicted on the copy and says the branch is as it was', async () => {
    const harnessed = harness();
    seedDraft({ harnessed });
    engine.runHistoryPlan.mockResolvedValue({
      kind: 'tried',
      result: {
        ...TRIED,
        head: null,
        check: null,
        stop: { sha: 'b2', index: 1, kind: 'merge', files: ['ledger.ts'], message: 'conflict' },
      },
    });

    await harnessed.slice.applyHistoryDraft({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      shouldPush: false,
    });

    const stop = harnessed.read().historyRuns[MOUNT_ID]?.stop;
    expect(stop?.reason).toBe('conflict');
    expect(stop?.message).toBe(
      'Step 2 of 2, “Retry duplicate events”, conflicts in ledger.ts. The temporary copy was removed. Your branch is exactly as it was.',
    );
    expect(engine.applyHistoryPlan).not.toHaveBeenCalled();
  });

  it('refuses a result the check on the copy did not pass', async () => {
    const harnessed = harness();
    seedDraft({ harnessed });
    engine.runHistoryPlan.mockResolvedValue({
      kind: 'tried',
      result: {
        ...TRIED,
        check: {
          isPassed: false,
          expectsSameCode: true,
          problems: ['The result differs from what the plan should make in 1 file: ledger.ts.'],
          unexpectedFiles: ['ledger.ts'],
          removedFiles: [],
        },
      },
    });

    await harnessed.slice.applyHistoryDraft({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      shouldPush: true,
    });

    const run = harnessed.read().historyRuns[MOUNT_ID];
    expect(run?.stop?.reason).toBe('unverified');
    expect(run?.stop?.files).toEqual(['ledger.ts']);
    expect(run?.applied).toBeNull();
    expect(engine.applyHistoryPlan).not.toHaveBeenCalled();
  });

  it('keeps the rewrite here and reports it when the remote moved before the push', async () => {
    const harnessed = harness();
    seedDraft({ harnessed });
    engine.runHistoryPlan.mockResolvedValue({ kind: 'tried', result: TRIED });
    engine.pushWithLease.mockResolvedValue({ kind: 'stale', message: 'stale info' });

    await expect(
      harnessed.slice.applyHistoryDraft({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        shouldPush: true,
      }),
    ).resolves.toBe('stopped');

    const run = harnessed.read().historyRuns[MOUNT_ID];
    expect(run?.stop?.reason).toBe('origin-moved');
    expect(run?.applied).not.toBeNull();
    expect(engine.pushWithLease).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRemoteSha: 'remote-sha' }),
    );
  });

  it('stops before moving anything when a teammate pushed during the trial', async () => {
    const harnessed = harness();
    seedDraft({ harnessed });
    engine.runHistoryPlan.mockResolvedValue({ kind: 'tried', result: TRIED });
    engine.readRemoteLease.mockResolvedValue({ kind: 'not-included', sha: 'teammate-sha' });

    await expect(
      harnessed.slice.applyHistoryDraft({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        shouldPush: true,
      }),
    ).resolves.toBe('stopped');

    expect(engine.readRemoteLease).toHaveBeenCalledWith(
      expect.objectContaining({ expectedHead: 'head-sha', incorporated: null }),
    );
    expect(harnessed.read().historyRuns[MOUNT_ID]?.stop?.reason).toBe('origin-moved');
    expect(engine.applyHistoryPlan).not.toHaveBeenCalled();
    expect(engine.pushWithLease).not.toHaveBeenCalled();
  });

  it('pushes with the online sha the plan includes', async () => {
    const harnessed = harness();
    seedDraft({ harnessed });
    engine.runHistoryPlan.mockResolvedValue({ kind: 'tried', result: TRIED });
    engine.readRemoteLease.mockResolvedValue({ kind: 'included', sha: 'included-sha' });

    await harnessed.slice.applyHistoryDraft({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      shouldPush: true,
    });

    expect(engine.pushWithLease).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRemoteSha: 'included-sha' }),
    );
  });

  it('refuses to apply to another branch when the place switched during the trial', async () => {
    const harnessed = harness();
    seedDraft({ harnessed });
    engine.runHistoryPlan.mockImplementation(async () => {
      const state = harnessed.read() as unknown as Record<string, unknown>;
      const mounts = state['sessionProjectMounts'] as Record<
        string,
        Array<Record<string, unknown>>
      >;
      mounts[SESSION_ID] = (mounts[SESSION_ID] ?? []).map((mount) => ({
        ...mount,
        branch: 'fix/other-branch',
      }));
      return { kind: 'tried', result: TRIED };
    });

    await expect(
      harnessed.slice.applyHistoryDraft({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        shouldPush: true,
      }),
    ).resolves.toBe('stopped');

    expect(engine.applyHistoryPlan).not.toHaveBeenCalled();
    expect(engine.pushWithLease).not.toHaveBeenCalled();
    expect(harnessed.read().historyRuns[MOUNT_ID]?.stop?.message).toContain('fix/ledger-postings');
  });

  it('forgets a finished run when you are done', async () => {
    const harnessed = harness();
    seedDraft({ harnessed });
    engine.runHistoryPlan.mockResolvedValue({ kind: 'tried', result: TRIED });
    await harnessed.slice.applyHistoryDraft({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      shouldPush: false,
    });
    harnessed.slice.dismissHistoryRun({ sessionId: SESSION_ID, mountId: MOUNT_ID });
    expect(harnessed.read().historyRuns[MOUNT_ID]).toBeUndefined();
  });
});

describe('plan editing', () => {
  it('keeps each edit on an undo stack that command Z walks back', async () => {
    const harnessed = harness();
    seedDraft({ harnessed });
    const next: ReadonlyArray<HistoryStep> = [
      { sha: 'a1', verb: 'pick' },
      { sha: 'b2', verb: 'drop' },
    ];
    await harnessed.slice.editHistoryDraft({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      items: next,
    });
    expect(harnessed.read().historyDrafts[MOUNT_ID]?.items).toEqual(next);
    expect(harnessed.read().historyDrafts[MOUNT_ID]?.undo).toEqual([
      { items: PLAN_ITEMS, onto: null },
    ]);
    await expect(
      harnessed.slice.undoHistoryDraft({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).resolves.toBe(true);
    expect(harnessed.read().historyDrafts[MOUNT_ID]?.items).toEqual(PLAN_ITEMS);
    await expect(
      harnessed.slice.undoHistoryDraft({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).resolves.toBe(false);
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

describe('bring origin into the plan', () => {
  it('replays what origin gained on top of the rewrite and leaves the push to a lease', async () => {
    const { slice, read } = harness();
    const state = read() as unknown as Record<string, unknown>;
    state['historyRuns'] = {
      [MOUNT_ID]: {
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        origin: 'plan',
        phase: 'stopped',
        planId: 'plan-1',
        agentId: null,
        copyPath: null,
        stop: { reason: 'origin-moved', message: 'moved', files: [], sha: null },
        result: null,
        backupRef: null,
        remoteSha: 'remote-at-apply',
        holder: null,
        updatedAt: 1,
      },
    };
    engine.readOriginAhead.mockResolvedValue({
      remoteSha: 'remote-now',
      commits: [{ sha: 'teammate1', subject: 'Teammate adds a note' }],
      fetchError: null,
    });
    engine.tryHistoryPlan.mockResolvedValue({
      head: 'joined',
      map: [{ from: 'teammate1', to: 'joined' }],
      isTreeEqual: false,
      changedFiles: [],
      stop: null,
      copyPath: null,
      order: [],
    });

    await expect(
      slice.bringOriginIntoHistory({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).resolves.toBe('applied');

    expect(engine.readOriginAhead).toHaveBeenCalledWith(
      expect.objectContaining({ branch: 'fix/ledger-postings', since: 'remote-at-apply' }),
    );
    expect(engine.tryHistoryPlan).toHaveBeenCalledWith({
      worktreePath: '/w/ledger',
      base: 'head-sha',
      head: 'head-sha',
      steps: [{ sha: 'teammate1', verb: 'pick' }],
    });
    expect(engine.applyHistoryPlan).toHaveBeenCalledWith(
      expect.objectContaining({ expectedHead: 'head-sha', newHead: 'joined' }),
    );
    expect(engine.pushWithLease).not.toHaveBeenCalled();
    expect(read().historyRuns[MOUNT_ID]?.phase).toBe('applied');
  });
});

describe('rewriterKickoff', () => {
  it('numbers the plan, names the stopped step and asks to keep empty steps as commits', () => {
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
    expect(text).toContain('git commit --allow-empty');
    expect(text).not.toContain('skip it');
    expect(text).toContain('keep the retry key from main');
  });
});
