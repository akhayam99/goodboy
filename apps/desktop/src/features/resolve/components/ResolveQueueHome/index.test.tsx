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
    sessionResolveThreads: {} as Record<string, ReadonlyArray<unknown>>,
    providers: [{ id: 'anthropic', connection: 'connected' }] as ReadonlyArray<unknown>,
    resolveQueueView: {} as Record<string, unknown>,
    activePublicationPreview: {} as Record<string, unknown>,
    reviewTargets: {} as Record<string, unknown>,
    loadResolveSession: vi.fn(async () => undefined),
    deferResolveQueueItem: vi.fn(async () => undefined),
    takeUpResolveQueueItem: vi.fn(async () => undefined),
    refreshSessionPrDetail: vi.fn(async () => undefined),
    setResolveQueueView: vi.fn(),
    consumeReviewTarget: vi.fn(),
    openResolveDiff: vi.fn(),
    spawnAgent: vi.fn(
      async (_sessionId: string, _args: { sourceThreadIds?: unknown }) => 'agent-1',
    ),
    setAgentConfig: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
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
  ResolveItemContainer: ({
    row,
    onSelect,
  }: {
    readonly row: { thread: { threadId: string } };
    readonly onSelect: (threadId: string | null) => void;
  }) => (
    <div data-testid="resolve-item">
      <span data-testid="resolve-item-thread">{row.thread.threadId}</span>
      <button type="button" data-resolve-primary onClick={() => onSelect(null)}>
        Approve fix
      </button>
      <textarea aria-label="Reply to reviewer" />
    </div>
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
  stage: 'new',
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
      patch: { expandedThreadId: 'PRRT_1', order: ['PRRT_1'] },
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

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain("Couldn't load the pull request");
    expect(alert.textContent).toContain('The pull request is not available');
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

    expect(screen.getByTestId('resolve-item-thread').textContent).toBe('PRRT_1');
    expect(h.state.consumeReviewTarget).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      requestId: 'req-1',
    });
  });
});

describe('walking the queue from the keyboard', () => {
  const twoRows = () => {
    h.state.sessionGithub = {
      [SESSION_ID]: {
        pr: { number: 248, url: 'https://github.com/acme/web/pull/248', state: 'open' },
        detail: {
          prNumber: 248,
          comments: [commentOf('PRRT_1'), commentOf('PRRT_2')],
          reviews: [],
          checks: [],
        },
        detailLoading: false,
        detailError: null,
      },
    };
    h.state.sessionResolveQueueItems = {
      [SESSION_ID]: [
        entryOf({ item: { id: 'item-1', threadId: 'PRRT_1' }, thread: { threadId: 'PRRT_1' } }),
        entryOf({ item: { id: 'item-2', threadId: 'PRRT_2' }, thread: { threadId: 'PRRT_2' } }),
      ],
    };
  };

  const rowFor = (threadId: string): HTMLElement => {
    const row = document.querySelector<HTMLElement>(`[data-thread-id="${threadId}"]`);
    if (row === null) {
      throw new Error(`no row for ${threadId}`);
    }
    return row;
  };

  it('moves focus down and up without opening a comment', () => {
    twoRows();
    render(<ResolveQueueHome session={SESSION} />);

    fireEvent.keyDown(rowFor('PRRT_1'), { key: 'ArrowDown' });

    expect(document.activeElement).toBe(rowFor('PRRT_2'));
    expect(h.state.setResolveQueueView).not.toHaveBeenCalled();

    h.state.setResolveQueueView.mockClear();
    fireEvent.keyDown(rowFor('PRRT_2'), { key: 'ArrowUp' });

    expect(document.activeElement).toBe(rowFor('PRRT_1'));
    expect(h.state.setResolveQueueView).not.toHaveBeenCalled();
  });

  it('stops at the ends rather than wrapping the list around', () => {
    twoRows();
    render(<ResolveQueueHome session={SESSION} />);

    fireEvent.keyDown(rowFor('PRRT_1'), { key: 'ArrowUp' });

    expect(h.state.setResolveQueueView).not.toHaveBeenCalled();
  });

  it('leaves a control inside a row alone, so its own key handling still runs', () => {
    twoRows();
    h.state.resolveQueueView = {
      [SESSION_ID]: {
        filter: 'needs_review',
        expandedThreadId: 'PRRT_1',
        order: [],
        scrollTop: 0,
      },
    };
    render(<ResolveQueueHome session={SESSION} />);

    const overlay = rowFor('PRRT_2');
    const inner = within(overlay.parentElement ?? overlay)
      .getAllByRole('button', { hidden: true })
      .find((button) => button !== overlay);
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    inner?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores an arrow pressed with a modifier, which belongs to the app', () => {
    twoRows();
    render(<ResolveQueueHome session={SESSION} />);

    fireEvent.keyDown(rowFor('PRRT_1'), { key: 'ArrowDown', metaKey: true });

    expect(h.state.setResolveQueueView).not.toHaveBeenCalled();
  });

  it('opens the panel and lands the focus in it on the first Enter', () => {
    twoRows();
    const { rerender } = render(<ResolveQueueHome session={SESSION} />);

    fireEvent.keyDown(rowFor('PRRT_2'), { key: 'Enter' });

    expect(h.state.setResolveQueueView).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      patch: { expandedThreadId: 'PRRT_2', order: ['PRRT_1', 'PRRT_2'] },
    });

    h.state.resolveQueueView = {
      [SESSION_ID]: { filter: 'needs_review', expandedThreadId: 'PRRT_2', order: [], scrollTop: 0 },
    };
    rerender(<ResolveQueueHome session={SESSION} />);

    expect(document.activeElement).toBe(
      within(screen.getByTestId('resolve-item')).getByRole('button', { name: 'Approve fix' }),
    );
  });

  it('carries the focus into the comment the decision moved on to', () => {
    twoRows();
    h.state.resolveQueueView = {
      [SESSION_ID]: { filter: 'needs_review', expandedThreadId: 'PRRT_1', order: [], scrollTop: 0 },
    };
    const { rerender } = render(<ResolveQueueHome session={SESSION} />);

    const approve = within(screen.getByTestId('resolve-item')).getByRole('button', {
      name: 'Approve fix',
    });
    approve.focus();
    fireEvent.click(approve);

    h.state.resolveQueueView = {
      [SESSION_ID]: { filter: 'needs_review', expandedThreadId: 'PRRT_2', order: [], scrollTop: 0 },
    };
    rerender(<ResolveQueueHome session={SESSION} />);

    expect(screen.getByTestId('resolve-item-thread').textContent).toBe('PRRT_2');
    expect(document.activeElement).toBe(
      within(screen.getByTestId('resolve-item')).getByRole('button', { name: 'Approve fix' }),
    );
  });

  it('moves focus into a comment opened with the mouse', () => {
    twoRows();
    h.state.resolveQueueView = {
      [SESSION_ID]: { filter: 'needs_review', expandedThreadId: 'PRRT_1', order: [], scrollTop: 0 },
    };
    const { rerender } = render(<ResolveQueueHome session={SESSION} />);

    fireEvent.click(rowFor('PRRT_2'));

    h.state.resolveQueueView = {
      [SESSION_ID]: { filter: 'needs_review', expandedThreadId: 'PRRT_2', order: [], scrollTop: 0 },
    };
    rerender(<ResolveQueueHome session={SESSION} />);

    expect(screen.getByTestId('resolve-item-thread').textContent).toBe('PRRT_2');
    expect(document.activeElement).toBe(
      within(screen.getByTestId('resolve-item')).getByRole('button', { name: 'Approve fix' }),
    );
  });

  it('stays on a parked comment instead of jumping to the top of the list', () => {
    twoRows();
    h.state.sessionResolveQueueItems = {
      [SESSION_ID]: [
        entryOf({ item: { id: 'item-1', threadId: 'PRRT_1' }, thread: { threadId: 'PRRT_1' } }),
        entryOf({
          item: { id: 'item-2', threadId: 'PRRT_2', approvalState: 'deferred', deferredAt: 3 },
          thread: { threadId: 'PRRT_2', stage: 'parked' },
        }),
      ],
    };
    render(<ResolveQueueHome session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show later (1)' }));

    expect(h.state.setResolveQueueView).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      patch: { isDeferredShown: true },
    });
  });

  it('hands Escape back to the reply field the maintainer is typing in', () => {
    twoRows();
    h.state.resolveQueueView = {
      [SESSION_ID]: { filter: 'needs_review', expandedThreadId: 'PRRT_1', order: [], scrollTop: 0 },
    };
    render(<ResolveQueueHome session={SESSION} />);

    const field = screen.getByLabelText('Reply to reviewer');
    field.focus();
    fireEvent.keyDown(field, { key: 'Escape' });

    expect(document.activeElement).toBe(field);
  });

  it('closes the panel on unhandled Escape', () => {
    twoRows();
    h.state.resolveQueueView = {
      [SESSION_ID]: { filter: 'needs_review', expandedThreadId: 'PRRT_1', order: [], scrollTop: 0 },
    };
    render(<ResolveQueueHome session={SESSION} />);

    const approve = within(screen.getByTestId('resolve-item')).getByRole('button', {
      name: 'Approve fix',
    });
    approve.focus();
    fireEvent.keyDown(approve, { key: 'Escape' });

    expect(h.state.setResolveQueueView).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      patch: { expandedThreadId: null, order: ['PRRT_1', 'PRRT_2'] },
    });
  });

  it('keeps Enter on the open row going straight to the panel', () => {
    twoRows();
    h.state.resolveQueueView = {
      [SESSION_ID]: { filter: 'needs_review', expandedThreadId: 'PRRT_1', order: [], scrollTop: 0 },
    };
    render(<ResolveQueueHome session={SESSION} />);

    fireEvent.keyDown(rowFor('PRRT_1'), { key: 'Enter' });

    expect(document.activeElement).toBe(
      within(screen.getByTestId('resolve-item')).getByRole('button', { name: 'Approve fix' }),
    );
  });
});

describe('the shape of the queue surface', () => {
  const twoRows = () => {
    h.state.sessionGithub = {
      [SESSION_ID]: {
        pr: { number: 248, url: 'https://github.com/acme/web/pull/248', state: 'open' },
        detail: {
          prNumber: 248,
          comments: [commentOf('PRRT_1'), commentOf('PRRT_2')],
          reviews: [],
          checks: [],
        },
        detailLoading: false,
        detailError: null,
      },
    };
    h.state.sessionResolveQueueItems = {
      [SESSION_ID]: [
        entryOf({ item: { id: 'item-1', threadId: 'PRRT_1' }, thread: { threadId: 'PRRT_1' } }),
        entryOf({ item: { id: 'item-2', threadId: 'PRRT_2' }, thread: { threadId: 'PRRT_2' } }),
      ],
    };
  };

  it('scrolls the rows in their own bounded region, below a header that stays put', () => {
    twoRows();
    render(<ResolveQueueHome session={SESSION} />);

    const row = document.querySelector<HTMLElement>('[data-thread-id="PRRT_1"]') as HTMLElement;
    const viewport = row.closest('.overflow-y-auto') as HTMLElement;
    const region = viewport.parentElement as HTMLElement;

    expect(region.className).toContain('min-h-0');
    expect(region.className).toContain('flex-1');
    expect(region.contains(screen.getByRole('heading', { name: 'Conversations' }))).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Resolve 2 new' }).closest('.overflow-y-auto'),
    ).toBeNull();
  });

  it('starts one agent for the checked comments with a selection and Resolve N', async () => {
    twoRows();
    render(<ResolveQueueHome session={SESSION} />);

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      fireEvent.click(box);
    }
    const bar = screen.getByRole('toolbar', { name: '2 selected' });
    fireEvent.click(within(bar).getByRole('button', { name: 'Resolve 2' }));

    await vi.waitFor(() => expect(h.state.spawnAgent).toHaveBeenCalledTimes(1));
    const args = h.state.spawnAgent.mock.calls[0]?.[1];
    expect(args?.sourceThreadIds).toEqual(['PRRT_1', 'PRRT_2']);
    await vi.waitFor(() =>
      expect(h.state.setResolveQueueView).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: SESSION_ID }),
      ),
    );
  });

  it('offers no checkbox on a comment an agent is already working on', () => {
    twoRows();
    h.state.sessionResolveQueueItems = {
      [SESSION_ID]: [
        entryOf({ item: { id: 'item-1', threadId: 'PRRT_1' }, thread: { threadId: 'PRRT_1' } }),
        entryOf({
          item: { id: 'item-2', threadId: 'PRRT_2' },
          thread: { threadId: 'PRRT_2', state: 'working' },
        }),
      ],
    };
    render(<ResolveQueueHome session={SESSION} />);

    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('keeps the pull request header and the dock on the empty and error states', () => {
    h.state.sessionGithub = { [SESSION_ID]: { pr: null, detail: null } };
    const { unmount } = render(
      <ResolveQueueHome
        session={SESSION}
        header={<div>PR header</div>}
        dock={<div>Publish dock</div>}
      />,
    );

    expect(screen.getByText('PR header')).toBeDefined();
    expect(screen.getByText('Publish dock')).toBeDefined();
    unmount();

    twoRows();
    h.state.sessionGithub = {
      [SESSION_ID]: {
        pr: { number: 248, url: 'https://github.com/acme/web/pull/248', state: 'open' },
        detail: null,
        detailLoading: false,
        detailError: 'github is unreachable',
      },
    };
    render(
      <ResolveQueueHome
        session={SESSION}
        header={<div>PR header</div>}
        dock={<div>Publish dock</div>}
      />,
    );

    expect(screen.getByText('PR header')).toBeDefined();
    expect(screen.getByText('Publish dock')).toBeDefined();
  });

  it('counts the retryable tab like its siblings once a run fails', () => {
    twoRows();
    h.state.sessionResolveQueueItems = {
      [SESSION_ID]: [
        entryOf({ item: { id: 'item-1', threadId: 'PRRT_1' }, thread: { threadId: 'PRRT_1' } }),
        entryOf({
          item: { id: 'item-2', threadId: 'PRRT_2' },
          thread: { threadId: 'PRRT_2', activeAttemptId: 'attempt-1', stage: 'failed' },
        }),
      ],
    };
    h.state.sessionResolveAttempts = {
      [SESSION_ID]: [{ id: 'attempt-1', agentId: 'agent-1', phase: 'failed', createdAt: 1 }],
    };
    render(<ResolveQueueHome session={SESSION} />);

    expect(screen.getByRole('tab', { name: /^Needs review\s*2$/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /^Active\s*2$/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /^Retryable\s*1$/ })).toBeDefined();
  });

  it('drops the count from every tab that has nothing, the third one included', () => {
    twoRows();
    render(<ResolveQueueHome session={SESSION} />);

    expect(screen.getByRole('tab', { name: /^Needs review\s*2$/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /^Active\s*2$/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Retryable' })).toBeDefined();
  });
});
