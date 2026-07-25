import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
  sessionPendingResolutions: {},
  diffComments: { [SESSION_ID]: [] },
  sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
  pendingResolverKickoff: {},
  agentTurnState: {},
  sessionGithub: {
    [SESSION_ID]: {
      pr: { number: 7 },
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

import { ResolverInspector } from './index';

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

describe('ResolverInspector', () => {
  beforeEach(() => {
    h.runtime.events = [];
    h.listTurnEventsForAgent.mockResolvedValue([]);
    h.listBranchCommits.mockResolvedValue([COMMIT]);
  });

  afterEach(cleanup);

  it('groups the answers into the three governance questions', () => {
    render(
      <ResolverInspector sessionId={SESSION_ID} agentId={RUNNING_ID} onClose={() => undefined} />,
    );

    expect(screen.getByText('Where it came from')).toBeDefined();
    expect(screen.getByText('What it changed')).toBeDefined();
    expect(screen.getByText('What state it is in')).toBeDefined();
  });

  it('names the recorded origin and surfaces the comment behind it', () => {
    render(
      <ResolverInspector sessionId={SESSION_ID} agentId={RUNNING_ID} onClose={() => undefined} />,
    );

    expect(screen.getByText('Review comment')).toBeDefined();
    expect(screen.queryByText('inferred')).toBeNull();
    expect(screen.getByText('this needs a guard clause')).toBeDefined();
  });

  it('lists the files the resolver edited', () => {
    h.runtime.events = [fileEdit];

    render(
      <ResolverInspector sessionId={SESSION_ID} agentId={RUNNING_ID} onClose={() => undefined} />,
    );

    expect(screen.getByText('src/auth/guard.ts')).toBeDefined();
  });

  it('offers force close for the running resolver', () => {
    render(
      <ResolverInspector sessionId={SESSION_ID} agentId={RUNNING_ID} onClose={() => undefined} />,
    );

    expect(screen.getByRole('button', { name: 'Force close' })).toBeDefined();
  });

  it('explains why a queued resolver is blocked and where it sits', () => {
    render(
      <ResolverInspector sessionId={SESSION_ID} agentId={QUEUED_ID} onClose={() => undefined} />,
    );

    expect(screen.getByText('2 of 2 in the queue')).toBeDefined();
    expect(screen.getByText(/resolve: reviewer on a.ts is still running/)).toBeDefined();
  });
});
