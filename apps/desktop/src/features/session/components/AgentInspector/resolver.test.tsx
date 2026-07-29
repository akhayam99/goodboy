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
} from '@goodboy/types';

const SESSION_ID = 'session-1' as SessionId;
const RUNNING_ID = 'resolver-1' as AgentId;
const QUEUED_ID = 'resolver-2' as AgentId;

const h = vi.hoisted(() => {
  const runtime: { events: ReadonlyArray<unknown> } = { events: [] };
  return {
    runtime,
    listTurnEventsForAgent: vi.fn(async () => [] as ReadonlyArray<unknown>),
    listBranchCommits: vi.fn(async () => [] as ReadonlyArray<unknown>),
    forceCloseResolver: vi.fn(async () => undefined),
    resolveGithubThread: vi.fn(async () => true),
    resolveAgentThreads: vi.fn(async () => true),
    amendSessionCommit: vi.fn(async () => ({ sha: 'new1234', shortSha: 'new1234' })),
    squashSessionCommits: vi.fn(async () => ({ sha: 'new1234', shortSha: 'new1234' })),
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

const state = {
  sessionPhaseRuns: {
    [SESSION_ID]: [
      agent({
        id: RUNNING_ID,
        ordinal: 0,
        status: 'running',
        name: 'resolve: reviewer on a.ts',
        sourceThreadId: 'PRRT_1',
        sourceCommentUrl: 'https://github.com/x/y/pull/7#discussion_r1',
        sourceKind: 'review_comment',
        startedAt: '2026-07-25T09:00:00.000Z' as IsoDateTime,
      }),
      agent({ id: QUEUED_ID, ordinal: 1, name: 'resolve: reviewer on b.ts' }),
    ],
  },
  agentKindOverride: {},
  resolverState: {},
  resolverThreadOutcomes: {
    [RUNNING_ID]: { PRRT_1: { kind: 'resolved', commitSha: 'abc1234def' } },
  },
  sessionPendingResolutions: {},
  diffComments: { [SESSION_ID]: [] },
  sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
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
          },
        ],
      },
    },
  },
  forceCloseResolver: h.forceCloseResolver,
  resolveGithubThread: h.resolveGithubThread,
  resolveAgentThreads: h.resolveAgentThreads,
  amendSessionCommit: h.amendSessionCommit,
  squashSessionCommits: h.squashSessionCommits,
};

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useDiffComments: () => [],
}));

vi.mock('../../../../store/transcript', () => ({
  useTranscript: () => h.runtime.events,
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

describe('AgentInspector (resolver)', () => {
  beforeEach(() => {
    h.runtime.events = [];
    h.listTurnEventsForAgent.mockResolvedValue([]);
    h.listBranchCommits.mockResolvedValue([COMMIT]);
  });

  afterEach(cleanup);

  it('adds the resolver sections to the shared agent inspector', () => {
    render(
      <AgentInspector sessionId={SESSION_ID} agentId={RUNNING_ID} onClose={() => undefined} />,
    );

    expect(screen.getByText('What it is')).toBeDefined();
    expect(screen.getByText('What it costs')).toBeDefined();
    expect(screen.getByText('Where it came from')).toBeDefined();
    expect(screen.getByText('What it changed')).toBeDefined();
    expect(screen.getByText('What state it is in')).toBeDefined();
    expect(screen.getByText('What you can do with the thread')).toBeDefined();
    expect(screen.getByText('What you can do')).toBeDefined();
  });

  it('names the recorded origin and surfaces the comment behind it', () => {
    render(
      <AgentInspector sessionId={SESSION_ID} agentId={RUNNING_ID} onClose={() => undefined} />,
    );

    expect(screen.getByText('Review comment')).toBeDefined();
    expect(screen.queryByText('inferred')).toBeNull();
    expect(screen.getByText('this needs a guard clause')).toBeDefined();
  });

  it('lists the files the resolver edited', () => {
    h.runtime.events = [fileEdit];

    render(
      <AgentInspector sessionId={SESSION_ID} agentId={RUNNING_ID} onClose={() => undefined} />,
    );

    expect(screen.getByText('src/auth/guard.ts')).toBeDefined();
  });

  it('opens the commit diff filtered on the file the resolver edited', () => {
    h.runtime.events = [fileEdit];
    const seen: Array<unknown> = [];
    const listener = (event: Event) => seen.push((event as CustomEvent).detail);
    window.addEventListener('goodboy:open-commit-diff', listener);

    render(
      <AgentInspector sessionId={SESSION_ID} agentId={RUNNING_ID} onClose={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'src/auth/guard.ts' }));
    window.removeEventListener('goodboy:open-commit-diff', listener);

    expect(seen).toEqual([{ repo: 'x/y', sha: 'abc1234def', file: 'src/auth/guard.ts' }]);
  });

  it('offers force close for the running resolver', () => {
    render(
      <AgentInspector sessionId={SESSION_ID} agentId={RUNNING_ID} onClose={() => undefined} />,
    );

    expect(screen.getByRole('button', { name: 'Force close' })).toBeDefined();
  });

  it('rewords the newest local commit of the resolver', async () => {
    h.listBranchCommits.mockResolvedValue([LOCAL_COMMIT]);

    render(
      <AgentInspector sessionId={SESSION_ID} agentId={RUNNING_ID} onClose={() => undefined} />,
    );
    const reword = await screen.findByRole('button', { name: 'Reword' });
    fireEvent.click(reword);
    const input = screen.getByLabelText('new message for this commit');
    fireEvent.change(input, { target: { value: 'fix(auth): guard the session' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save message' }));

    expect(h.amendSessionCommit).toHaveBeenCalledWith(SESSION_ID, {
      sha: 'abc1234def',
      message: 'fix(auth): guard the session',
    });
  });

  it('blocks reword when another commit is the branch HEAD', async () => {
    h.listBranchCommits.mockResolvedValue([OTHER_AGENT_HEAD, LOCAL_COMMIT]);

    render(
      <AgentInspector sessionId={SESSION_ID} agentId={RUNNING_ID} onClose={() => undefined} />,
    );
    const reword = await screen.findByRole('button', { name: 'Reword' });

    expect(reword.hasAttribute('disabled')).toBe(true);
    expect(reword.getAttribute('title')).toBe('Only the branch HEAD commit can be reworded');
    expect(screen.getByRole('button', { name: 'Squash through HEAD' })).toBeDefined();
  });

  it('squashes from an older local commit and leaves a pushed one alone', async () => {
    h.listBranchCommits.mockResolvedValue([LOCAL_COMMIT, OLDER_LOCAL_COMMIT, PUSHED_COMMIT]);

    render(
      <AgentInspector sessionId={SESSION_ID} agentId={RUNNING_ID} onClose={() => undefined} />,
    );
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

  it('explains why a queued resolver is blocked and where it sits', () => {
    render(<AgentInspector sessionId={SESSION_ID} agentId={QUEUED_ID} onClose={() => undefined} />);

    expect(screen.getByText('2 of 2 in the queue')).toBeDefined();
    expect(screen.getByText(/resolve: reviewer on a.ts is still running/)).toBeDefined();
  });
});
