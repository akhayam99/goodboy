import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  BranchCommit,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';
import type { ResolverState } from '../../resolver-linkage';

const SESSION_ID = 'session-1' as SessionId;
const RUNNING_ID = 'resolver-1' as AgentId;
const QUEUED_ID = 'resolver-2' as AgentId;
const SETTLED_ID = 'resolver-3' as AgentId;

const h = vi.hoisted(() => {
  const runtime: { events: ReadonlyArray<unknown> } = { events: [] };
  return {
    runtime,
    state: {} as Record<string, unknown>,
    listTurnEventsForAgent: vi.fn(async () => [] as ReadonlyArray<unknown>),
    listBranchCommits: vi.fn(async () => [] as ReadonlyArray<unknown>),
    forceCloseResolver: vi.fn(async () => undefined),
    resolveGithubThread: vi.fn(async () => true),
    resolveAgentThreads: vi.fn(async () => true),
    queueResolution: vi.fn(async () => undefined),
    dequeueResolution: vi.fn(async () => undefined),
    activateNextResolver: vi.fn(async () => undefined),
    sendTurn: vi.fn(async () => undefined),
    selectAgent: vi.fn(async () => undefined),
    setAgentDone: vi.fn(async () => undefined),
    clearAgentDone: vi.fn(async () => undefined),
    deleteAgent: vi.fn(async () => undefined),
    amendSessionCommit: vi.fn(async () => ({ sha: 'new1234', shortSha: 'new1234' })),
    squashSessionCommits: vi.fn(async () => ({ sha: 'new1234', shortSha: 'new1234' })),
    setActiveLens: vi.fn(),
    setDiffFocus: vi.fn(),
  };
});

const agent = (over: Partial<Agent> & { id: AgentId }): Agent => ({
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'resolve: reviewer on a.ts',
  status: 'pending',
  kind: 'resolver',
  ...over,
});

const RUNNING = agent({
  id: RUNNING_ID,
  ordinal: 0,
  status: 'running',
  name: 'resolve: reviewer on a.ts',
  sourceThreadId: 'PRRT_1',
  sourceCommentUrl: 'https://github.com/x/y/pull/7#discussion_r1',
  sourceKind: 'review_comment',
  startedAt: '2026-07-25T09:00:00.000Z' as IsoDateTime,
});

const QUEUED = agent({ id: QUEUED_ID, ordinal: 1, name: 'resolve: reviewer on b.ts' });

const SETTLED = agent({
  id: SETTLED_ID,
  ordinal: 2,
  status: 'completed',
  name: 'resolve: reviewer on c.ts',
  sourceThreadId: 'PRRT_3',
  sourceKind: 'review_comment',
  startedAt: '2026-07-25T09:00:00.000Z' as IsoDateTime,
  completedAt: '2026-07-25T09:03:12.000Z' as IsoDateTime,
});

type ResetParams = {
  readonly resolverState?: Readonly<Record<string, ResolverState>>;
  readonly resolvedThreadIds?: ReadonlyArray<string>;
  readonly outcomes?: Readonly<Record<string, unknown>>;
  readonly pending?: ReadonlyArray<{ readonly threadId: string; readonly commitSha: string }>;
};

const reset = ({
  resolverState = {},
  resolvedThreadIds = [],
  outcomes = { [RUNNING_ID]: { PRRT_1: { kind: 'resolved', commitSha: 'abc1234def' } } },
  pending = [],
}: ResetParams = {}) => {
  Object.assign(h.state, {
    sessions: [{ id: SESSION_ID, workspaceId: 'workspace-1' as WorkspaceId }],
    workspaces: [{ id: 'workspace-1' as WorkspaceId, rootPath: '/tmp/repo', kind: 'repo' }],
    sessionPhaseRuns: { [SESSION_ID]: [RUNNING, QUEUED, SETTLED] },
    agentKindOverride: {},
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    resolverState,
    resolverThreadOutcomes: outcomes,
    sessionPendingResolutions: { [SESSION_ID]: pending },
    diffComments: { [SESSION_ID]: [] },
    sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
    sessionMounts: {},
    sessionActiveMount: {},
    sessionBranches: { [SESSION_ID]: 'ak/resolver' },
    pendingResolverKickoff: {},
    agentTurnState: {},
    sessionGithub: {
      [SESSION_ID]: {
        pr: { number: 7, url: 'https://github.com/x/y/pull/7' },
        detail: {
          comments: [
            {
              id: 'c1',
              author: 'reviewer',
              body: 'this needs a guard clause',
              url: 'https://github.com/x/y/pull/7#discussion_r1',
              source: 'review',
              threadId: 'PRRT_1',
              path: 'a.ts',
              line: 12,
              resolved: resolvedThreadIds.includes('PRRT_1'),
            },
            {
              id: 'c3',
              author: 'reviewer',
              body: 'this one too',
              url: 'https://github.com/x/y/pull/7#discussion_r3',
              source: 'review',
              threadId: 'PRRT_3',
              path: 'c.ts',
              line: 4,
              resolved: resolvedThreadIds.includes('PRRT_3'),
            },
          ],
        },
      },
    },
    forceCloseResolver: h.forceCloseResolver,
    resolveGithubThread: h.resolveGithubThread,
    resolveAgentThreads: h.resolveAgentThreads,
    queueResolution: h.queueResolution,
    dequeueResolution: h.dequeueResolution,
    activateNextResolver: h.activateNextResolver,
    sendTurn: h.sendTurn,
    selectAgent: h.selectAgent,
    setAgentDone: h.setAgentDone,
    clearAgentDone: h.clearAgentDone,
    deleteAgent: h.deleteAgent,
    amendSessionCommit: h.amendSessionCommit,
    squashSessionCommits: h.squashSessionCommits,
    setActiveLens: h.setActiveLens,
    setDiffFocus: h.setDiffFocus,
  });
};

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: typeof h.state) => T) => selector(h.state),
  useDiffComments: () => [],
}));

vi.mock('../../../../store/transcript', () => ({
  useTranscript: () => h.runtime.events,
}));

vi.mock('../../../../store/slices/worktrees/useSessionRepo', () => ({
  useSessionRepo: () => ({
    repoRoot: '/tmp/repo',
    worktreePath: '/tmp/wt',
    branch: 'ak/resolver',
    mountName: null,
    workspaceId: 'workspace-1',
  }),
}));

vi.mock('@goodboy/db', () => ({ listTurnEventsForAgent: h.listTurnEventsForAgent }));
vi.mock('../../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../worktree/worktree', () => ({ listBranchCommits: h.listBranchCommits }));

vi.mock('../../hooks/useAgentMetrics', () => ({
  useAgentMetrics: () => ({
    latestTelemetryByAgentId: new Map(),
    aggregatesByAgentId: new Map(),
    providerUsageByAgentId: new Map(),
    turnsByAgentId: new Map(),
  }),
}));

import { AgentInspector } from './index';

const fileEdit: TurnEvent = {
  kind: 'file_edit',
  runId: 'run-1' as ProviderRunId,
  path: 'src/auth/guard.ts',
  editType: 'modify',
  at: '2026-07-25T09:01:00.000Z' as IsoDateTime,
};

const resolvedMarker: TurnEvent = {
  kind: 'assistant_text',
  runId: 'run-1' as ProviderRunId,
  delta: '<<comment-resolved threadId="PRRT_1" commitSha="deadbee" />>',
  at: '2026-07-25T09:02:00.000Z' as IsoDateTime,
};

const COMMIT: BranchCommit = {
  sha: 'abc1234def',
  shortSha: 'abc1234',
  subject: 'fix(auth): guard the nullable session',
  author: 'agent',
  timestamp: 1,
  pushed: false,
  parentSha: null,
};

const RUN_EPOCH = Math.floor(Date.parse('2026-07-25T09:00:00.000Z') / 1000);

const LOCAL_COMMIT: BranchCommit = { ...COMMIT, timestamp: RUN_EPOCH + 120 };

const OLDER_LOCAL_COMMIT: BranchCommit = {
  ...COMMIT,
  sha: 'older12345',
  shortSha: 'older12',
  subject: 'wip',
  timestamp: RUN_EPOCH + 60,
};

const OTHER_AGENT_HEAD: BranchCommit = {
  ...COMMIT,
  sha: 'other12345',
  shortSha: 'other12',
  subject: 'fix: later work from another agent',
  timestamp: RUN_EPOCH - 10,
};

const PUSHED_COMMIT: BranchCommit = {
  ...COMMIT,
  sha: 'pushed1234',
  shortSha: 'pushed1',
  subject: 'refactor: extract the guard',
  timestamp: RUN_EPOCH + 30,
  pushed: true,
};

const renderInspector = (agentId: AgentId) =>
  render(<AgentInspector sessionId={SESSION_ID} agentId={agentId} onClose={() => undefined} />);

const openOverflow = () =>
  fireEvent.click(screen.getByRole('button', { name: 'more resolver actions' }));

describe('AgentInspector (resolver)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.runtime.events = [];
    h.listTurnEventsForAgent.mockResolvedValue([]);
    h.listBranchCommits.mockResolvedValue([COMMIT]);
    reset();
  });

  afterEach(cleanup);

  it('leads with the state and drops the question-headed sections', () => {
    renderInspector(RUNNING_ID);

    expect(screen.getByText('working')).toBeDefined();
    expect(screen.getByText('Comment')).toBeDefined();
    expect(screen.queryByText('What it is')).toBeNull();
    expect(screen.queryByText('What it costs')).toBeNull();
    expect(screen.queryByText('What state it is in')).toBeNull();
    expect(screen.queryByText('What you can do')).toBeNull();
    expect(screen.queryByText('not blocked')).toBeNull();
  });

  it.each([
    ['committed', 'fix committed, ready to push'],
    ['analyzed', 'verdict ready'],
    ['wontfix', 'recommends closing without a change'],
    ['awaiting', 'asked you a question'],
    ['stopped', 'stopped before a verdict'],
  ] as ReadonlyArray<readonly [ResolverState, string]>)(
    'explains the %s state in one sentence',
    (state, sentence) => {
      reset({ resolverState: { [SETTLED_ID]: state } });
      renderInspector(SETTLED_ID);

      expect(screen.getByText(sentence)).toBeDefined();
    },
  );

  it('says a resolver finished without a verdict', () => {
    renderInspector(SETTLED_ID);

    expect(screen.getByText('finished without a verdict')).toBeDefined();
  });

  it('places the resolver in the queue and names what blocks it', () => {
    renderInspector(QUEUED_ID);

    expect(screen.getByText('2 of 3')).toBeDefined();
    expect(screen.getByText(/resolve: reviewer on a.ts is still running/)).toBeDefined();
  });

  it('offers no action block while working', () => {
    renderInspector(RUNNING_ID);

    expect(screen.queryByRole('button', { name: 'Push & resolve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Run again' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Force close' })).toBeNull();
  });

  it('offers no action block once the thread is resolved', () => {
    reset({ resolvedThreadIds: ['PRRT_3'] });
    renderInspector(SETTLED_ID);

    expect(screen.getByText('resolved')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Run again' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark resolved' })).toBeNull();
  });

  it('offers a rerun and a manual resolve on a resolver that never reached a verdict', () => {
    renderInspector(SETTLED_ID);

    expect(screen.getByRole('button', { name: 'Run again' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mark resolved' })).toBeDefined();
  });

  it('names the recorded origin and surfaces the comment behind it', () => {
    renderInspector(RUNNING_ID);

    expect(screen.getByText('Review comment')).toBeDefined();
    expect(screen.queryByText('inferred')).toBeNull();
    expect(screen.getByText('this needs a guard clause')).toBeDefined();
    expect(screen.getByRole('button', { name: /Open on GitHub/ })).toBeDefined();
  });

  it('reads the verdict the agent wrote once it stops working', () => {
    reset({
      resolverState: { [SETTLED_ID]: 'wontfix' },
      outcomes: {
        [SETTLED_ID]: {
          PRRT_3: { kind: 'wontfix', reason: 'covered by the follow up', reply: 'Already guarded' },
        },
      },
    });
    renderInspector(SETTLED_ID);

    expect(screen.getByText('Verdict')).toBeDefined();
    expect(screen.getByText('covered by the follow up')).toBeDefined();
    expect(screen.getByText('Already guarded')).toBeDefined();
  });

  it('hides the changes section entirely when there is no commit', () => {
    h.runtime.events = [fileEdit];
    renderInspector(RUNNING_ID);

    expect(screen.queryByText('Changes')).toBeNull();
    expect(screen.queryByText('src/auth/guard.ts')).toBeNull();
    expect(screen.queryByText('No commit from this resolver yet')).toBeNull();
  });

  it('lists the commit and the files it derives from it', async () => {
    h.listBranchCommits.mockResolvedValue([LOCAL_COMMIT]);
    h.runtime.events = [fileEdit];
    renderInspector(RUNNING_ID);

    expect(await screen.findByText('Changes')).toBeDefined();
    expect(screen.getByText('fix(auth): guard the nullable session')).toBeDefined();
    expect(screen.getByText('src/auth/guard.ts')).toBeDefined();
  });

  it('opens the diff lens on the file the resolver edited, at the commit it reported', async () => {
    h.listBranchCommits.mockResolvedValue([LOCAL_COMMIT]);
    h.runtime.events = [fileEdit];
    renderInspector(RUNNING_ID);

    fireEvent.click(await screen.findByRole('button', { name: 'src/auth/guard.ts' }));

    expect(h.setDiffFocus).toHaveBeenCalledWith(SESSION_ID, {
      sha: 'abc1234def',
      path: 'src/auth/guard.ts',
    });
    expect(h.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'files');
  });

  it('opens the diff lens at a reported sha the branch does not carry', () => {
    h.runtime.events = [resolvedMarker];
    renderInspector(RUNNING_ID);

    fireEvent.click(screen.getByRole('button', { name: 'deadbee' }));

    expect(h.setDiffFocus).toHaveBeenCalledWith(SESSION_ID, { sha: 'deadbee', path: null });
    expect(h.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'files');
  });

  it('keeps force close, mark done and delete behind the header overflow', () => {
    renderInspector(RUNNING_ID);

    expect(screen.queryByRole('menuitem', { name: 'Force close' })).toBeNull();

    openOverflow();

    expect(screen.getByRole('menuitem', { name: 'Force close' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Mark done' })).toBeDefined();
  });

  it('rewords the newest local commit from the overflow', async () => {
    h.listBranchCommits.mockResolvedValue([LOCAL_COMMIT]);
    renderInspector(RUNNING_ID);
    openOverflow();

    const reword = await screen.findByRole('button', { name: 'Reword' });
    fireEvent.click(reword);
    fireEvent.change(screen.getByLabelText('new message for this commit'), {
      target: { value: 'fix(auth): guard the session' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save message' }));

    expect(h.amendSessionCommit).toHaveBeenCalledWith(SESSION_ID, {
      sha: 'abc1234def',
      message: 'fix(auth): guard the session',
    });
  });

  it('blocks reword when another commit is the branch HEAD', async () => {
    h.listBranchCommits.mockResolvedValue([OTHER_AGENT_HEAD, LOCAL_COMMIT]);
    renderInspector(RUNNING_ID);
    openOverflow();

    const reword = await screen.findByRole('button', { name: 'Reword' });

    expect(reword.hasAttribute('disabled')).toBe(true);
    expect(reword.getAttribute('title')).toBe('Only the branch HEAD commit can be reworded');
    expect(screen.getByRole('button', { name: 'Squash through HEAD' })).toBeDefined();
  });

  it('squashes from an older local commit and leaves a pushed one alone', async () => {
    h.listBranchCommits.mockResolvedValue([LOCAL_COMMIT, OLDER_LOCAL_COMMIT, PUSHED_COMMIT]);
    renderInspector(RUNNING_ID);
    openOverflow();

    const squash = await screen.findByRole('button', { name: 'Squash through HEAD' });
    fireEvent.click(squash);
    fireEvent.click(screen.getByRole('button', { name: 'Squash into one' }));

    expect(h.squashSessionCommits).toHaveBeenCalledWith(SESSION_ID, {
      sha: 'older12345',
      message: 'wip',
    });
    expect(screen.getByText('already pushed')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Squash through HEAD' })).toHaveLength(1);
  });
});
