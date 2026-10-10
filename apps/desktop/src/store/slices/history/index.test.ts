// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  BranchCommit,
  HistoryPlanArgs,
  HistoryStep,
  HistoryTrialProgress,
  MountId,
  ProjectId,
  ResolveThread,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';

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
  worktreeStatus: vi.fn(
    async (params: {
      worktreePath: string;
      baseBranch?: string | null;
    }): Promise<{
      upstream: string | null;
      head: string;
      workingTree: {
        kind: string;
        reason?: string;
        staged?: number;
        unstaged?: number;
        untracked?: number;
        unmerged?: number;
        changed?: number;
      };
    }> => {
      void params;
      return {
        upstream: 'origin/fix/ledger-postings',
        head: 'head-sha',
        workingTree: {
          kind: 'known',
          staged: 0,
          unstaged: 0,
          untracked: 0,
          unmerged: 0,
          changed: 0,
        },
      };
    },
  ),
  worktreeRemoteHead: vi.fn(async () => 'remote-sha'),
}));

const replies = vi.hoisted(() => ({ editPostedReplies: vi.fn(async () => 0) }));

vi.mock('../../../features/history/historyEngine', () => engine);
vi.mock('../resolve/editPostedReplies', () => replies);
vi.mock('../../../features/worktree/worktree', () => worktree);
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    listResolvePublicationsForSession: vi.fn(async () => []),
    setResolvePublicationPhase: vi.fn(async () => undefined),
    markHistoryPlan: vi.fn(async () => undefined),
    saveDraftHistoryPlan: vi.fn(async () => ({ id: 'plan-1' })),
    getDraftHistoryPlan: vi.fn(async () => null),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => undefined),
  }),
);
vi.mock('../../../features/session/taskModelAgentSpawnConfig', () => ({
  taskModelAgentSpawnConfig: () => ({
    hint: '',
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
  }),
}));

import { useAppStore, type AppStore } from '../../store';
import { createHistorySlice } from './index';
import { historyInitialState } from './state';
import { resetWorktreeStatusCache } from '../worktreeStatuses/cache';
import { assertCleanTree } from './assertCleanTree';
import { rewriterCopyFor } from './rewriterCopyFor';
import { rewriterKickoff } from './rewriterKickoff';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-ledger' as SessionId;
const PROJECT_ID = 'project-ledger' as ProjectId;
const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const IDENTITY = {
  worktreePath: '/w/ledger',
  branch: 'fix/ledger-postings',
  projectId: PROJECT_ID,
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

type Bases = {
  readonly mount: string | null;
  readonly project: string | null;
};

const harness = ({ mount, project }: Bases = { mount: 'main', project: 'main' }) => {
  const spawnAgent = vi.fn<AppStore['spawnAgent']>(async () => AGENT_ID);
  const sendTurn = vi.fn<AppStore['sendTurn']>(async () => ({ blockedOverBudget: false }));
  let state: AppStore = {
    ...useAppStore.getInitialState(),
    ...historyInitialState,
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    projects: [
      aProject({
        id: PROJECT_ID,
        name: 'ledger-core',
        workspaceId: WORKSPACE_ID,
        baseBranch: project,
      }),
    ],
    sessionProjectMounts: {
      [SESSION_ID]: [
        {
          mountId: MOUNT_ID,
          sessionId: SESSION_ID,
          projectId: PROJECT_ID,
          mountName: 'ledger-core',
          worktreePath: '/w/ledger',
          lastWorktreePath: null,
          repoRoot: '/repos/ledger-core',
          branch: 'fix/ledger-postings',
          baseBranch: mount,
          parallelIndex: 0,
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
    spawnAgent,
    sendTurn,
    updateResolveThread: vi.fn(async () => true),
    refreshPrDescription: vi.fn(async () => false),
    refreshSessionPr: vi.fn(async () => undefined),
    loadHistoryDraft: vi.fn(async () => undefined),
  };
  const set: SetFn = (patch) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  };
  const get: GetFn = () => state;
  const slice = createHistorySlice({ set, get });
  state = { ...state, ...slice };
  return { slice, read: get, seed: set, spawnAgent, sendTurn };
};

const DIRTY_TREE = {
  upstream: 'origin/fix/ledger-postings',
  head: 'head-sha',
  workingTree: { kind: 'known', staged: 4, unstaged: 5, untracked: 2, unmerged: 0, changed: 11 },
};

const DIRTY_SENTENCE = '11 files have changes that are not committed. Commit or stash them first.';

beforeEach(() => {
  resetWorktreeStatusCache();
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

const statusBases = (): ReadonlyArray<string | null | undefined> =>
  worktree.worktreeStatus.mock.calls.map(([params]) => params.baseBranch);

describe('the base branch of a history run', () => {
  const cleanReplay = () => {
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
  };

  beforeEach(() => {
    worktree.worktreeStatus.mockClear();
  });

  it('rebases onto the mount base and reads every status against it', async () => {
    const { slice } = harness({ mount: 'develop', project: 'main' });
    cleanReplay();

    await slice.rebaseBranch({ sessionId: SESSION_ID, mountId: MOUNT_ID });

    expect(engine.readRebasePlan).toHaveBeenCalledWith(
      expect.objectContaining({ baseBranch: 'develop' }),
    );
    expect(statusBases().length).toBeGreaterThan(0);
    expect(new Set(statusBases())).toEqual(new Set(['develop']));
  });

  it('falls back to the project base when the mount has none', async () => {
    const { slice } = harness({ mount: null, project: 'develop' });
    cleanReplay();

    await slice.rebaseBranch({ sessionId: SESSION_ID, mountId: MOUNT_ID });

    expect(engine.readRebasePlan).toHaveBeenCalledWith(
      expect.objectContaining({ baseBranch: 'develop' }),
    );
    expect(new Set(statusBases())).toEqual(new Set(['develop']));
  });

  it('lets Rust choose the base when neither the mount nor the project names one', async () => {
    const { slice, read } = harness({ mount: null, project: null });
    cleanReplay();

    await slice.rebaseBranch({ sessionId: SESSION_ID, mountId: MOUNT_ID });

    expect(engine.readRebasePlan).toHaveBeenCalledWith(
      expect.objectContaining({ baseBranch: null }),
    );
    expect(new Set(statusBases().map((base) => base ?? null))).toEqual(new Set([null]));
    expect(read().recordSessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rebase_requested',
        payload: expect.objectContaining({ branch: 'origin/main' }),
      }),
    );
  });

  it('reads the status of a restore against the mount base', async () => {
    const { slice } = harness({ mount: 'develop', project: 'main' });
    engine.restoreHistoryBackup.mockResolvedValue({
      kind: 'moved',
      head: 'backup-sha',
      backupRef: 'refs/goodboy/backup/fix-ledger-postings/keep-2',
    });

    await slice.restoreHistory({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      backupRef: 'refs/goodboy/backup/fix-ledger-postings/1',
      shouldPush: false,
    });

    expect(statusBases().length).toBeGreaterThan(0);
    expect(new Set(statusBases())).toEqual(new Set(['develop']));
  });

  it('reads the status of bringing origin in against the mount base', async () => {
    const { slice } = harness({ mount: 'develop', project: 'main' });
    engine.readOriginAhead.mockResolvedValue({
      remoteSha: 'remote-now',
      commits: [],
      fetchError: null,
    });

    await slice.bringOriginIntoHistory({ sessionId: SESSION_ID, mountId: MOUNT_ID });

    expect(worktree.worktreeStatus).toHaveBeenCalledWith({
      worktreePath: '/w/ledger',
      baseBranch: 'develop',
    });
  });
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
    expect(replies.editPostedReplies).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID }),
    );
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
    const { slice, read, spawnAgent, sendTurn } = harness();
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
    spawnAgent.mockRejectedValueOnce(new Error('no room for another agent'));
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
    sendTurn.mockRejectedValueOnce(new Error('the provider is offline'));
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
    const { slice, read, seed } = harness();
    const plan: HistoryPlanArgs = {
      worktreePath: '/w/ledger',
      base: 'onto-sha',
      head: 'head-sha',
      steps: [{ sha: 'a1', verb: 'pick' }],
    };
    seed({
      historyRewriters: {
        [AGENT_ID]: {
          sessionId: SESSION_ID,
          mountId: MOUNT_ID,
          copyPath: '/tmp/goodboy-history-copy',
          plan,
          origin: 'rebase',
          planId: null,
          identity: IDENTITY,
        },
      },
    });
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
    const { slice, read, seed } = harness();
    seed({
      historyRewriters: {
        [AGENT_ID]: {
          sessionId: SESSION_ID,
          mountId: MOUNT_ID,
          copyPath: '/tmp/goodboy-history-copy',
          plan: { worktreePath: '/w/ledger', base: 'onto-sha', head: 'head-sha', steps: [] },
          origin: 'rebase',
          planId: null,
          identity: IDENTITY,
        },
      },
    });

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

const resolveThreadOf = ({
  threadId,
  commitShas,
  fixupOfSha,
  replacesSha,
}: {
  readonly threadId: string;
  readonly commitShas: ReadonlyArray<string>;
  readonly fixupOfSha: string | null;
  readonly replacesSha: string | null;
}): ResolveThread => ({
  id: `row-${threadId}`,
  sessionId: SESSION_ID,
  projectId: null,
  prNumber: 318,
  threadId,
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'answered',
  stage: 'new',
  stateReason: null,
  revision: 1,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition: 'fix',
  replyDraft: null,
  commitShas,
  fixupOfSha,
  replacesSha,
  question: null,
  replyPostedAt: null,
  replyId: null,
  githubResolved: null,
  closedAt: null,
  closedSource: null,
  createdAt: 1,
  updatedAt: 1,
});

const seedDraft = ({
  harnessed,
  onto = null,
  items = PLAN_ITEMS,
}: {
  readonly harnessed: ReturnType<typeof harness>;
  readonly onto?: string | null;
  readonly items?: ReadonlyArray<HistoryStep>;
}) => {
  harnessed.seed({
    historyDrafts: {
      [MOUNT_ID]: {
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        planId: 'plan-1',
        branch: 'fix/ledger-postings',
        baseSha: 'base-sha',
        headSha: 'head-sha',
        commits: PLAN_COMMITS,
        items,
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

describe('preflight on a dirty tree', () => {
  const dirtyOnce = () => worktree.worktreeStatus.mockResolvedValueOnce(DIRTY_TREE);

  it('refuses a rebase before any try, copy or agent and records no stop', async () => {
    const { slice, read, spawnAgent } = harness();
    dirtyOnce();

    await expect(slice.rebaseBranch({ sessionId: SESSION_ID, mountId: MOUNT_ID })).rejects.toThrow(
      DIRTY_SENTENCE,
    );

    expect(engine.readRebasePlan).not.toHaveBeenCalled();
    expect(engine.predictHistoryPlan).not.toHaveBeenCalled();
    expect(engine.tryHistoryPlan).not.toHaveBeenCalled();
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(read().historyRuns[MOUNT_ID]).toBeUndefined();
    expect(read().recordSessionEvent).not.toHaveBeenCalled();
  });

  it('refuses to sync with the remote and says why', async () => {
    const { slice } = harness();
    dirtyOnce();

    await expect(
      slice.syncBranchWithRemote({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).resolves.toEqual({ kind: 'failed', message: DIRTY_SENTENCE });

    expect(engine.readRebasePlan).not.toHaveBeenCalled();
    expect(engine.tryHistoryPlan).not.toHaveBeenCalled();
  });

  it('refuses a restore before it moves the branch', async () => {
    const { slice, read } = harness();
    dirtyOnce();

    await expect(
      slice.restoreHistory({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        backupRef: 'refs/goodboy/backup/fix-ledger-postings/1',
        shouldPush: false,
      }),
    ).rejects.toThrow(DIRTY_SENTENCE);

    expect(engine.restoreHistoryBackup).not.toHaveBeenCalled();
    expect(read().historyRuns[MOUNT_ID]).toBeUndefined();
  });

  it('refuses to bring origin in before it reads or tries anything', async () => {
    const { slice, read } = harness();
    dirtyOnce();

    await expect(
      slice.bringOriginIntoHistory({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).rejects.toThrow(DIRTY_SENTENCE);

    expect(engine.readOriginAhead).not.toHaveBeenCalled();
    expect(engine.tryHistoryPlan).not.toHaveBeenCalled();
    expect(read().historyRuns[MOUNT_ID]).toBeUndefined();
  });

  it('reads the tree again when a clean read just happened', async () => {
    const target = { worktreePath: '/w/ledger', baseBranch: 'main' };
    await expect(assertCleanTree(target)).resolves.toBeUndefined();
    dirtyOnce();

    await expect(assertCleanTree(target)).rejects.toThrow(DIRTY_SENTENCE);
  });

  it('refuses a rebase when the tree status cannot be read', async () => {
    const { slice, read } = harness();
    worktree.worktreeStatus.mockRejectedValueOnce(new Error('status read failed'));

    await expect(slice.rebaseBranch({ sessionId: SESSION_ID, mountId: MOUNT_ID })).rejects.toThrow(
      "Couldn't check for uncommitted changes. Try again.",
    );

    expect(engine.readRebasePlan).not.toHaveBeenCalled();
    expect(read().historyRuns[MOUNT_ID]).toBeUndefined();
  });

  it('refuses a sync with the reason when the working tree state is unknown', async () => {
    const { slice } = harness();
    worktree.worktreeStatus.mockResolvedValueOnce({
      upstream: null,
      head: 'head-sha',
      workingTree: { kind: 'unknown', reason: 'status-read-failed' },
    });

    await expect(
      slice.syncBranchWithRemote({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).resolves.toEqual({
      kind: 'failed',
      message: "Couldn't check for uncommitted changes. Try again.",
    });

    expect(engine.readRebasePlan).not.toHaveBeenCalled();
  });

  it('lets a clean tree through to the rebase', async () => {
    const { slice } = harness();
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

    await slice.rebaseBranch({ sessionId: SESSION_ID, mountId: MOUNT_ID });

    expect(engine.readRebasePlan).toHaveBeenCalledTimes(1);
  });
});

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
        absorbed: { x1: [{ sha: 'b2', title: 'Retry duplicate events', mode: 'fixup' }] },
        lines: [
          {
            action: 'fixup',
            text: 'Folded “Retry duplicate events” into “Guard the settlement batch”, keeping its title',
            sha: 'b2',
            target: 'a1',
          },
          {
            action: 'rebase',
            text: "Started the branch from today's main",
            sha: null,
            target: 'main-sha',
          },
        ],
      }),
    );
    expect(engine.pushWithLease).not.toHaveBeenCalled();
  });

  it('names a fold target by its new title when the same rewrite renamed it', async () => {
    const harnessed = harness();
    seedDraft({
      harnessed,
      items: [
        { sha: 'a1', verb: 'reword', message: 'Guard every settlement batch\n\nBody' },
        { sha: 'b2', verb: 'fixup', target: 'a1' },
      ],
    });
    engine.runHistoryPlan.mockResolvedValue({ kind: 'tried', result: TRIED });

    await harnessed.slice.applyHistoryDraft({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      shouldPush: false,
    });

    expect(harnessed.read().historyRuns[MOUNT_ID]?.applied?.lines.map((line) => line.text)).toEqual(
      [
        'Folded “Retry duplicate events” into “Guard every settlement batch”, keeping its title',
        'Renamed “Guard the settlement batch” to “Guard every settlement batch”',
      ],
    );
  });

  it('counts as new only the commits the rewrite made, never one it kept as it was', async () => {
    const harnessed = harness();
    seedDraft({ harnessed });
    engine.runHistoryPlan.mockResolvedValue({
      kind: 'tried',
      result: {
        ...TRIED,
        map: [
          { from: 'a1', to: 'a1' },
          { from: 'b2', to: 'x2' },
        ],
      },
    });

    await harnessed.slice.applyHistoryDraft({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      shouldPush: false,
    });

    expect(harnessed.read().historyRuns[MOUNT_ID]?.applied?.newShas).toEqual(['x2']);
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
      harnessed.seed({
        sessionProjectMounts: {
          [SESSION_ID]: (harnessed.read().sessionProjectMounts[SESSION_ID] ?? []).map((mount) => ({
            ...mount,
            branch: 'fix/other-branch',
          })),
        },
      });
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
  it('restores here but never pushes over online commits newer than the backup', async () => {
    const { slice, read } = harness();
    const backupRef = 'refs/goodboy/backup/b-6669782f6c6564676572/1790000000000000000';
    engine.readRemoteLease.mockImplementation(async ({ expectedHead }: { expectedHead: string }) =>
      expectedHead === backupRef
        ? { kind: 'not-included', sha: 'teammate-sha' }
        : { kind: 'included', sha: 'teammate-sha' },
    );
    engine.restoreHistoryBackup.mockResolvedValue({
      kind: 'moved',
      head: 'backup-sha',
      backupRef: 'refs/goodboy/backup/b-6669782f6c6564676572/keep-1790000000000000001',
    });

    await expect(
      slice.restoreHistory({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        backupRef,
        shouldPush: true,
      }),
    ).resolves.toBe('stopped');

    expect(engine.restoreHistoryBackup).toHaveBeenCalled();
    expect(engine.pushWithLease).not.toHaveBeenCalled();
    expect(read().historyRuns[MOUNT_ID]?.stop?.message).toContain('nothing was pushed');
  });

  it('checks an older backup against the remote seen when the last rewrite was applied', async () => {
    const { slice, read, seed } = harness();
    const backupRef = 'refs/goodboy/backup/b-6669782f6c6564676572/1790000000000000000';
    seed({
      historyRuns: {
        [MOUNT_ID]: {
          sessionId: SESSION_ID,
          mountId: MOUNT_ID,
          origin: 'plan',
          phase: 'pushed',
          planId: 'plan-2',
          agentId: null,
          copyPath: null,
          stop: null,
          result: null,
          backupRef: 'refs/goodboy/backup/b-6669782f6c6564676572/1790000000000000001',
          remoteSha: 'teammate-sha',
          holder: null,
          progress: null,
          applied: null,
          identity: null,
          movedHead: 'rewrite-two',
          threadShas: [],
          updatedAt: 1,
        },
      },
    });
    engine.readRemoteLease.mockResolvedValue({ kind: 'not-included', sha: 'rewrite-two' });
    engine.restoreHistoryBackup.mockResolvedValue({
      kind: 'moved',
      head: 'backup-sha',
      backupRef: 'refs/goodboy/backup/b-6669782f6c6564676572/keep-1790000000000000002',
    });

    await expect(
      slice.restoreHistory({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        backupRef,
        shouldPush: true,
      }),
    ).resolves.toBe('stopped');

    expect(engine.readRemoteLease).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedHead: backupRef,
        incorporated: 'rewrite-two',
        incorporatedSince: 'teammate-sha',
      }),
    );
    expect(engine.pushWithLease).not.toHaveBeenCalled();
  });

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

describe('resolve shas across a rewrite and its undo', () => {
  it('remaps the thread shas on apply and puts them back when the backup is restored', async () => {
    const { slice, read, seed } = harness();
    seed({
      sessionResolveThreads: {
        [SESSION_ID]: [
          resolveThreadOf({
            threadId: 'thread-mara',
            commitShas: ['c81'],
            fixupOfSha: '7be',
            replacesSha: null,
          }),
        ],
      },
    });
    const update = read().updateResolveThread;

    await expect(
      slice.applyHistoryRewrite({
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        origin: 'plan',
        planId: null,
        newHead: 'new-head',
        expectedHead: 'head-sha',
        map: [
          { from: '7be', to: 'e31' },
          { from: 'c81', to: 'e31' },
        ],
        shouldPush: false,
        byAgent: false,
        identity: IDENTITY,
      }),
    ).resolves.toBe('applied');
    expect(update).toHaveBeenLastCalledWith({
      sessionId: SESSION_ID,
      threadId: 'thread-mara',
      patch: { commitShas: ['e31'], fixupOfSha: 'e31', replacesSha: null },
    });

    engine.restoreHistoryBackup.mockResolvedValue({
      kind: 'moved',
      head: 'head-sha',
      backupRef: 'refs/goodboy/backup/fix-ledger-postings/2',
    });
    await slice.restoreHistory({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      backupRef: 'refs/goodboy/backup/fix-ledger-postings/1',
      shouldPush: false,
    });
    expect(update).toHaveBeenLastCalledWith({
      sessionId: SESSION_ID,
      threadId: 'thread-mara',
      patch: { commitShas: ['c81'], fixupOfSha: '7be', replacesSha: null },
    });
    expect(read().historyRuns[MOUNT_ID]?.threadShas).toEqual([]);
  });
});

describe('bring origin into the plan', () => {
  it('replays what origin gained on top of the rewrite and leaves the push to a lease', async () => {
    const { slice, read, seed } = harness();
    seed({
      historyRuns: {
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
          progress: null,
          applied: null,
          identity: null,
          movedHead: null,
          threadShas: [],
          updatedAt: 1,
        },
      },
    });
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

describe('sync the branch with its remote', () => {
  const TRIED = {
    head: 'new-head',
    map: [{ from: 'a1', to: 'x1' }],
    isTreeEqual: false,
    changedFiles: [],
    stop: null,
    copyPath: null,
    order: [],
    check: null,
  };

  it('rebases the local commits on the remote branch and never pushes', async () => {
    const { slice } = harness();
    engine.predictHistoryPlan.mockResolvedValue({ isSupported: true, head: 'predicted' });
    engine.tryHistoryPlan.mockResolvedValue(TRIED);

    await expect(
      slice.syncBranchWithRemote({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).resolves.toEqual({ kind: 'synced', count: 18 });

    expect(engine.readRebasePlan).toHaveBeenCalledWith({
      worktreePath: '/w/ledger',
      baseBranch: 'fix/ledger-postings',
      fetches: true,
    });
    expect(engine.applyHistoryPlan).toHaveBeenCalledWith(
      expect.objectContaining({ expectedHead: 'head-sha', newHead: 'new-head' }),
    );
    expect(engine.pushWithLease).not.toHaveBeenCalled();
  });

  it('stops on a predicted conflict without trying, applying or starting an agent', async () => {
    const { slice, read } = harness();
    engine.predictHistoryPlan.mockResolvedValue({ isSupported: true, head: null });

    await expect(
      slice.syncBranchWithRemote({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).resolves.toEqual({ kind: 'conflict' });

    expect(engine.tryHistoryPlan).not.toHaveBeenCalled();
    expect(engine.applyHistoryPlan).not.toHaveBeenCalled();
    expect(read().spawnAgent).not.toHaveBeenCalled();
  });

  it('removes the copy of a trial that conflicted and leaves the branch alone', async () => {
    const { slice, read } = harness();
    engine.predictHistoryPlan.mockResolvedValue({ isSupported: false, head: null });
    engine.tryHistoryPlan.mockResolvedValue({
      ...TRIED,
      head: null,
      copyPath: '/tmp/copy',
      stop: { kind: 'conflict' },
    });

    await expect(
      slice.syncBranchWithRemote({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).resolves.toEqual({ kind: 'conflict' });

    expect(engine.discardHistoryCopy).toHaveBeenCalledWith({
      worktreePath: '/w/ledger',
      copyPath: '/tmp/copy',
    });
    expect(engine.applyHistoryPlan).not.toHaveBeenCalled();
    expect(read().spawnAgent).not.toHaveBeenCalled();
  });

  it('says when there is nothing to bring in and when origin cannot be reached', async () => {
    const { slice } = harness();
    engine.readRebasePlan.mockResolvedValueOnce({ ...REBASE, behind: 0 });
    await expect(
      slice.syncBranchWithRemote({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).resolves.toEqual({ kind: 'nothing' });

    engine.readRebasePlan.mockResolvedValueOnce({ ...REBASE, fetchError: 'network is down' });
    await expect(
      slice.syncBranchWithRemote({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).resolves.toEqual({ kind: 'failed', message: "Couldn't reach origin: network is down" });
    expect(engine.tryHistoryPlan).not.toHaveBeenCalled();
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
    expect(text).toContain('never run git worktree, git stash');
    expect(text).not.toContain('skip it');
    expect(text).toContain('keep the retry key from main');
  });
});
