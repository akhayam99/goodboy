// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  PrComment,
  ResolvePublicationThread,
  ResolveQueueItem,
  ResolveQueueItemWithThread,
  ResolveThread,
  Session,
  SessionId,
} from '@goodboy/types';

const h = vi.hoisted(() => {
  const state = {
    sessionGithub: {} as Record<string, unknown>,
    sessionResolveQueueItems: {} as Record<string, ReadonlyArray<unknown>>,
    sessionResolveAttempts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionResolvePublications: {} as Record<string, ReadonlyArray<unknown>>,
    resolveQueueView: {} as Record<string, unknown>,
    reviewTargets: {} as Record<string, unknown>,
    loadResolveSession: vi.fn(async () => undefined),
    deferResolveQueueItem: vi.fn(async () => undefined),
    takeUpResolveQueueItem: vi.fn(async () => undefined),
    refreshSessionPrDetail: vi.fn(async () => undefined),
    setResolveQueueView: vi.fn(),
    consumeReviewTarget: vi.fn(),
    openResolveDiff: vi.fn(),
    spawnAgent: vi.fn(async () => 'agent-1'),
    setAgentConfig: vi.fn(),
  };
  return {
    state,
    receipts: [] as ReadonlyArray<ResolvePublicationThread>,
    openReview: vi.fn(async () => ({ kind: 'opened' as const })),
    showToast: vi.fn(),
  };
});

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: typeof h.state) => T) => selector(h.state),
}));
vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));
vi.mock('../../../../store/slices/worktrees/useSessionRepo', () => ({
  useSessionRepo: () => ({ worktreePath: '/tmp/work', repoRoot: 'acme/web' }),
}));
vi.mock('../../../../shared/hooks/useSessionRoleModels', () => ({
  useSessionRoleModels: () => ({}),
}));
vi.mock('../../hooks/useResolveDeliveryReceipts', () => ({
  useResolveDeliveryReceipts: () => h.receipts,
}));
vi.mock('../../../review/openReview', () => ({ openReview: h.openReview }));
vi.mock('../ResolveItemView/ResolveItemContainer', () => ({
  ResolveItemContainer: ({ row }: { readonly row: { thread: { threadId: string } } }) => (
    <div data-testid="resolve-item">{row.thread.threadId}</div>
  ),
}));

import { ResolveQueueHome } from './index';

const SESSION_ID = 'session-1' as SessionId;
const SESSION = { id: SESSION_ID, workspaceId: 'workspace-1' } as unknown as Session;

const threadOf = (patch: Partial<ResolveThread> = {}): ResolveThread => ({
  id: 'row-1',
  sessionId: SESSION_ID,
  projectId: null,
  prNumber: 248,
  threadId: 'PRRT_1',
  originKind: 'review_comment',
  state: 'open',
  stateReason: null,
  revision: 1,
  activeAttemptId: null,
  disposition: null,
  replyDraft: null,
  commitShas: null,
  question: null,
  replyPostedAt: null,
  replyId: null,
  githubResolved: null,
  closedAt: null,
  closedSource: null,
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

const itemOf = (patch: Partial<ResolveQueueItem> = {}): ResolveQueueItem => ({
  id: 'item-1',
  sessionId: SESSION_ID,
  threadId: 'PRRT_1',
  generation: 0,
  reopenedFromItemId: null,
  candidateRevision: 1,
  approvalState: 'none',
  approvedRevision: null,
  approvedReplyHash: null,
  integratedSha: null,
  deferredAt: null,
  deliveredAt: null,
  supersededAt: null,
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

const entryOf = ({
  item,
  thread,
}: {
  readonly item?: Partial<ResolveQueueItem>;
  readonly thread?: Partial<ResolveThread>;
} = {}): ResolveQueueItemWithThread => ({
  item: itemOf(item ?? {}),
  thread: threadOf(thread ?? {}),
});

const commentOf = (threadId: string): PrComment => ({
  id: `comment-${threadId}`,
  author: 'dhh',
  authorAvatarUrl: null,
  body: 'This retries forever on a 500.',
  createdAt: '2026-01-05T09:00:00.000Z',
  url: 'https://github.com/acme/web/pull/248#discussion_r1',
  source: 'review',
  resolved: false,
  path: 'src/retry.ts',
  line: 84,
  threadId,
});

const targetOf = (patch: Record<string, unknown>) => ({
  requestId: 'req-1',
  status: 'ready',
  destination: { kind: 'thread', mountId: 'mount-1', prNumber: 248, threadId: 'PRRT_1' },
  mode: null,
  reason: null,
  error: null,
  ...patch,
});

const seed = () => {
  h.receipts = [];
  h.state.sessionGithub = {
    [SESSION_ID]: {
      pr: { number: 248, url: 'https://github.com/acme/web/pull/248', state: 'open' },
      detail: { prNumber: 248, comments: [commentOf('PRRT_1')], reviews: [], checks: [] },
      detailLoading: false,
      detailError: null,
    },
  };
  h.state.sessionResolveQueueItems = { [SESSION_ID]: [entryOf()] };
  h.state.sessionResolveAttempts = {};
  h.state.sessionResolvePublications = {};
  h.state.resolveQueueView = {};
  h.state.reviewTargets = {};
};

beforeEach(() => {
  seed();
  h.openReview.mockClear();
  for (const value of Object.values(h.state)) {
    if (typeof value === 'function' && 'mockClear' in value) {
      (value as { mockClear: () => void }).mockClear();
    }
  }
});

afterEach(cleanup);

describe('the resolve queue home', () => {
  it('selects the thread a settled target names and then releases the target', () => {
    h.state.reviewTargets = { [SESSION_ID]: targetOf({}) };
    render(<ResolveQueueHome session={SESSION} />);

    expect(h.state.setResolveQueueView).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      patch: { expandedThreadId: 'PRRT_1' },
    });
    expect(h.state.consumeReviewTarget).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      requestId: 'req-1',
    });
  });

  it('waits on a pending target instead of selecting the wrong comment', () => {
    h.state.reviewTargets = { [SESSION_ID]: targetOf({ status: 'pending' }) };
    render(<ResolveQueueHome session={SESSION} />);

    expect(screen.getByText('Opening the comment')).toBeDefined();
    expect(h.state.setResolveQueueView).not.toHaveBeenCalled();
    expect(h.state.consumeReviewTarget).not.toHaveBeenCalled();
  });

  it('states inline that the comment left the pull request and selects nothing', () => {
    h.state.reviewTargets = {
      [SESSION_ID]: targetOf({
        status: 'unavailable',
        reason: 'no_thread',
        destination: {
          kind: 'thread',
          mountId: 'mount-1',
          prNumber: 248,
          threadId: 'PRRT_404',
        },
      }),
    };
    render(<ResolveQueueHome session={SESSION} />);

    expect(
      screen.getByText(/That comment is no longer in the selected pull request/),
    ).toBeDefined();
    expect(h.state.setResolveQueueView).not.toHaveBeenCalled();
    expect(h.state.consumeReviewTarget).not.toHaveBeenCalled();
    expect(screen.queryByTestId('resolve-item')).toBeNull();
  });

  it('retries a failed target on the pull request it was scoped to', () => {
    h.state.reviewTargets = {
      [SESSION_ID]: targetOf({ status: 'failed', error: 'network is down' }),
    };
    render(<ResolveQueueHome session={SESSION} />);

    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Retry' }));

    expect(h.openReview).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      destination: { kind: 'thread', mountId: 'mount-1', prNumber: 248, threadId: 'PRRT_1' },
    });
  });

  it('drops the open comment when a target settles on an error', () => {
    h.state.resolveQueueView = {
      [SESSION_ID]: { filter: 'needs_review', expandedThreadId: 'PRRT_1', order: [], scrollTop: 0 },
    };
    h.state.reviewTargets = {
      [SESSION_ID]: targetOf({
        status: 'unavailable',
        reason: 'thread_closed',
        destination: {
          kind: 'thread',
          mountId: 'mount-1',
          prNumber: 248,
          threadId: 'PRRT_404',
        },
      }),
    };
    render(<ResolveQueueHome session={SESSION} />);

    expect(screen.getByText(/That comment is already closed/)).toBeDefined();
    expect(h.state.setResolveQueueView).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      patch: { expandedThreadId: null },
    });
  });

  it('states a failed pull request navigation that names no comment', () => {
    h.state.reviewTargets = {
      [SESSION_ID]: targetOf({
        status: 'unavailable',
        reason: 'no_pull_request',
        destination: { kind: 'pull_request', mountId: 'mount-1', prNumber: 9108 },
      }),
    };
    render(<ResolveQueueHome session={SESSION} />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Could not load the pull request: The pull request is not available',
    );
  });

  it('opens a published comment from the history when the target names it', () => {
    h.state.sessionResolveQueueItems = {
      [SESSION_ID]: [
        entryOf({
          item: { approvalState: 'accepted', approvedRevision: 1, deliveredAt: 2 },
          thread: { state: 'closed' },
        }),
      ],
    };
    h.receipts = [
      {
        publicationId: 'pub-1',
        threadId: 'PRRT_1',
        revision: 1,
        priorState: 'publishing',
        sourceFingerprint: null,
        operationId: 'op-1',
        replyBody: 'Fixed in abc1234',
        replyPhase: 'posted',
        replyId: 'reply-1',
        replyAttemptedAt: 1,
        replyPostedAt: 2,
        resolvePhase: 'resolved',
        resolvedAt: 2,
        error: null,
      },
    ];
    h.state.resolveQueueView = {
      [SESSION_ID]: {
        filter: 'needs_review',
        expandedThreadId: 'PRRT_1',
        order: [],
        scrollTop: 0,
      },
    };
    h.state.reviewTargets = { [SESSION_ID]: targetOf({}) };
    render(<ResolveQueueHome session={SESSION} />);

    expect(screen.getByTestId('resolve-item').textContent).toBe('PRRT_1');
    expect(h.state.consumeReviewTarget).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      requestId: 'req-1',
    });
  });
});
