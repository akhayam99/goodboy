// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  PrComment,
  ResolvePublicationPreview,
  ResolveQueueItemWithThread,
  Session,
} from '@goodboy/types';

const h = vi.hoisted(() => {
  const state = {
    sessionGithub: {} as Record<string, unknown>,
    sessionSelectedPrNumber: {} as Record<string, number | null>,
    sessionExternalTasks: {} as Record<string, ReadonlyArray<unknown>>,
    branchPrs: [] as ReadonlyArray<unknown>,
    sessionResolveQueueItems: {} as Record<string, ReadonlyArray<unknown>>,
    sessionResolvePublications: {} as Record<string, ReadonlyArray<unknown>>,
    sessionResolveAttempts: {} as Record<string, ReadonlyArray<unknown>>,
    activePublicationPreview: {} as Record<string, unknown>,
    reviewDrafts: {} as Record<string, ReadonlyArray<unknown>>,
    diffComments: {} as Record<string, ReadonlyArray<unknown>>,
    prWriteClaims: {} as Record<string, unknown>,
    reviewTargets: {} as Record<
      string,
      {
        requestId: string;
        status: string;
        destination: Record<string, unknown>;
        mode: string | null;
        reason: string | null;
        error: string | null;
      } | null
    >,
    consumeReviewTarget: vi.fn(),
    loadResolveSession: vi.fn(async () => undefined),
    refreshSessionPr: vi.fn(async () => undefined),
    refreshSessionPrDetail: vi.fn(async () => undefined),
    selectSessionPr: vi.fn(async () => undefined),
    markPrReady: vi.fn(async () => undefined),
    convertPrToDraft: vi.fn(async () => undefined),
    mergePr: vi.fn(async () => undefined),
    closePr: vi.fn(async () => undefined),
    reopenPr: vi.fn(async () => undefined),
    editPr: vi.fn(async () => undefined),
    requestReview: vi.fn(async () => undefined),
    setFocusedGithubIssueNumber: vi.fn(),
    preparePublication: vi.fn(async () => null as unknown),
    publishConversations: vi.fn(
      async (params: { readonly sessionId: string; readonly publicationId: string }) => {
        void params;
        return { kind: 'done', pushed: true, closed: 1, replied: 1, failed: 0 };
      },
    ),
    cancelPublication: vi.fn(async () => undefined),
    retryPublication: vi.fn(async () => null as unknown),
    spawnAgent: vi.fn(async () => 'agent-new'),
    setActiveLens: vi.fn(),
    publishPrReview: vi.fn(async () => ({ published: 1, stale: [], failed: [], mismatched: [] })),
    loadReviewDrafts: vi.fn(async () => undefined),
    openDiffLens: vi.fn(),
    selectAgent: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
    navigate: vi.fn(),
    pullRequestModes: {} as Record<string, string>,
    setPullRequestMode: vi.fn(({ sessionId, mode }: { sessionId: string; mode: string }) => {
      state.pullRequestModes = { ...state.pullRequestModes, [sessionId]: mode };
      for (const listener of listeners) {
        listener();
      }
    }),
  };
  const listeners = new Set<() => void>();
  return { state, listeners, showToast: vi.fn() };
});

vi.mock('../../../../store', async () => {
  const { useEffect, useReducer } = await import('react');
  const useAppStore = <T,>(selector: (s: typeof h.state) => T) => {
    const [, bump] = useReducer((count: number) => count + 1, 0);
    useEffect(() => {
      h.listeners.add(bump);
      return () => {
        h.listeners.delete(bump);
      };
    }, []);
    return selector(h.state);
  };
  return {
    EMPTY_ARRAY: Object.freeze([]),
    useAppStore: Object.assign(useAppStore, { getState: () => h.state }),
    useCurrentWorkspace: () => ({ id: 'workspace-1', name: 'goodboy' }),
    useDiffComments: (sessionId: string) => h.state.diffComments[sessionId] ?? [],
    useSessionById: () => ({ id: 'session-1', workspaceId: 'workspace-1' }),
    sessionPlace: (params: Record<string, unknown>) => ({ kind: 'session', ...params }),
  };
});
vi.mock('../../../../store/slices/github/activeProjectPrs', () => ({
  selectActiveProjectPrs: () => h.state.branchPrs,
}));
vi.mock('../../../github/components/PullRequest/CreatePrPanel', () => ({
  CreatePrPanel: ({ onCancel }: { readonly onCancel?: () => void }) => (
    <div data-testid="create-pr">
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));
vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));
vi.mock('../../../../store/slices/worktrees/useSessionRepo', () => ({
  useSessionRepo: () => ({
    worktreePath: '/tmp/work',
    repoRoot: 'acme/web',
    branch: 'feature/retry',
    projectId: 'project-1',
  }),
}));
vi.mock('../../../../shared/hooks/useSessionRoleModels', () => ({
  useSessionRoleModels: () => ({}),
}));
vi.mock('../../../integrations/github/useGithubConnection', () => ({
  useGithubConnection: () => ({ isResolved: true, isAuthenticated: true, refresh: vi.fn() }),
}));
vi.mock('../../../github/usePrDraftAgentRunning', () => ({
  usePrDraftAgentRunning: () => false,
}));
vi.mock('../../../resolve/components/ResolveQueueHome', () => ({
  ResolveQueueHome: ({
    header,
    dock,
  }: {
    readonly header: React.ReactNode;
    readonly dock: React.ReactNode;
  }) => (
    <div data-testid="resolve-queue">
      {header}
      {dock}
    </div>
  ),
}));
vi.mock('./WriteReview', () => ({ WriteReview: () => <div data-testid="write-review" /> }));
vi.mock('../../../../shared/lib/editor', () => ({ openUrl: vi.fn(async () => undefined) }));

import { ReviewPane } from './index';

const SESSION = { id: 'session-1', workspaceId: 'workspace-1' } as unknown as Session;
const SESSION_ID = 'session-1';

const comment = ({
  id,
  threadId,
  path,
  line,
}: {
  readonly id: string;
  readonly threadId: string;
  readonly path: string;
  readonly line: number;
}): PrComment => ({
  id,
  author: 'harbor-reviewer',
  authorAvatarUrl: null,
  body: `comment on ${path}`,
  createdAt: '2026-01-01T00:00:00Z',
  url: `https://github.com/acme/web/pull/248#discussion_${id}`,
  source: 'review',
  resolved: false,
  threadId,
  path,
  line,
});

const entryOf = ({
  threadId,
  approvalState,
  deliveredAt,
}: {
  readonly threadId: string;
  readonly approvalState: 'none' | 'accepted' | 'deferred';
  readonly deliveredAt: number | null;
}): ResolveQueueItemWithThread =>
  ({
    item: {
      id: `item-${threadId}`,
      sessionId: SESSION_ID,
      threadId,
      approvalState,
      approvedRevision: approvalState === 'accepted' ? 1 : null,
      deliveredAt,
      integratedSha: null,
      deferredAt: null,
      supersededAt: null,
      candidateRevision: 1,
      generation: 0,
      reopenedFromItemId: null,
      approvedReplyHash: null,
      createdAt: 1,
      updatedAt: 1,
    },
    thread: { threadId, revision: 1, replyDraft: 'Added the early return.' },
  }) as unknown as ResolveQueueItemWithThread;

const previewOf = (patch: Partial<ResolvePublicationPreview>): ResolvePublicationPreview => ({
  publicationId: 'pub-1',
  repo: 'acme/web',
  prNumber: 248,
  branch: 'feature/retry',
  localHead: 'c3d4e5f0000',
  remoteHead: '9f8e7d60000',
  requiresPush: true,
  frozenAt: 1_700_000_000_000,
  commits: [],
  unapproved: [],
  replies: [{ threadId: 't-ready', body: 'Added the early return.', revision: 1, closes: true }],
  notes: [],
  excluded: [],
  drift: [],
  blocker: null,
  ...patch,
});

const seed = () => {
  h.state.sessionGithub = {
    [SESSION_ID]: {
      pr: {
        number: 248,
        title: 'Retry failed requests before opening the connection',
        url: 'https://github.com/acme/web/pull/248',
        state: 'open',
        mergeable: null,
        checks: null,
        baseBranch: 'main',
        headBranch: 'feature/retry',
        isDraft: true,
        reviewDecision: null,
        body: '',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      detail: {
        prNumber: 248,
        comments: [comment({ id: '2', threadId: 't-ready', path: 'src/retry.ts', line: 84 })],
        reviews: [],
        reviewRequests: [],
        checks: [],
      },
      detailLoading: false,
      detailError: null,
    },
  };
  h.state.sessionResolveQueueItems = {
    [SESSION_ID]: [entryOf({ threadId: 't-ready', approvalState: 'accepted', deliveredAt: null })],
  };
  h.state.activePublicationPreview = {};
  h.state.sessionResolvePublications = {};
  h.state.reviewDrafts = { [SESSION_ID]: [] };
  h.state.diffComments = { [SESSION_ID]: [] };
  h.state.reviewTargets = {};
  h.state.sessionSelectedPrNumber = {};
  h.state.sessionExternalTasks = {};
  h.state.branchPrs = [];
  h.state.prWriteClaims = {};
  h.state.pullRequestModes = {};
};

const patchPr = (patch: Record<string, unknown>) => {
  const github = h.state.sessionGithub[SESSION_ID] as { readonly pr: Record<string, unknown> };
  h.state.sessionGithub = {
    ...h.state.sessionGithub,
    [SESSION_ID]: { ...github, pr: { ...github.pr, ...patch } },
  };
};

beforeEach(() => {
  seed();
  for (const value of Object.values(h.state)) {
    if (typeof value === 'function' && 'mockClear' in value) {
      (value as { mockClear: () => void }).mockClear();
    }
  }
});

afterEach(cleanup);

describe('ReviewPane', () => {
  it('opens on the resolve queue and renders no second surface for the same work', () => {
    render(<ReviewPane session={SESSION} />);

    expect(screen.getByTestId('resolve-queue')).toBeDefined();
    expect(screen.queryByRole('listbox', { name: 'Review conversations' })).toBeNull();
  });

  it('leaves a thread target for the queue to consume', () => {
    h.state.reviewTargets = {
      [SESSION_ID]: {
        requestId: 'req-1',
        status: 'ready',
        destination: { kind: 'thread', mountId: null, prNumber: 248, threadId: 't-ready' },
        mode: null,
        reason: null,
        error: null,
      },
    };
    render(<ReviewPane session={SESSION} />);

    expect(h.state.consumeReviewTarget).not.toHaveBeenCalled();
  });

  it('holds the queue on a pending target instead of switching mode early', () => {
    h.state.reviewTargets = {
      [SESSION_ID]: {
        requestId: 'req-3',
        status: 'pending',
        destination: { kind: 'home' },
        mode: 'checks',
        reason: null,
        error: null,
      },
    };
    render(<ReviewPane session={SESSION} />);

    expect(screen.getByTestId('resolve-queue')).toBeDefined();
    expect(h.state.consumeReviewTarget).not.toHaveBeenCalled();
  });

  it('keeps a failed pull request navigation instead of forgetting it', () => {
    h.state.reviewTargets = {
      [SESSION_ID]: {
        requestId: 'req-4',
        status: 'unavailable',
        destination: { kind: 'pull_request', mountId: null, prNumber: 9108 },
        mode: null,
        reason: 'no_pull_request',
        error: null,
      },
    };
    render(<ReviewPane session={SESSION} />);

    expect(h.state.consumeReviewTarget).not.toHaveBeenCalled();
  });

  it('offers one publication review anchor for work approved but not sent', () => {
    render(<ReviewPane session={SESSION} />);

    expect(screen.getByRole('button', { name: 'Review publication' })).toBeDefined();
  });

  it('costs one press and one confirmation in the same strip', async () => {
    h.state.preparePublication.mockImplementation(async () => {
      h.state.activePublicationPreview = { [SESSION_ID]: previewOf({}) };
      return h.state.activePublicationPreview[SESSION_ID];
    });
    const { rerender } = render(<ReviewPane session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Review publication' }));
    await waitFor(() => expect(h.state.preparePublication).toHaveBeenCalledTimes(1));
    rerender(<ReviewPane session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: /^Close \d+ on GitHub$/ }));

    await waitFor(() => expect(h.state.publishConversations).toHaveBeenCalledTimes(1));
    expect(h.state.publishConversations.mock.calls[0]?.[0]).toMatchObject({
      publicationId: 'pub-1',
    });
  });

  it('keeps Review on the notes when the session has no pull request', () => {
    h.state.sessionGithub = {
      [SESSION_ID]: { pr: null, detail: null, detailLoading: false, detailError: null },
    };
    render(<ReviewPane session={SESSION} />);

    expect(screen.getByTestId('resolve-queue')).toBeDefined();
    expect(screen.getByText('No pull request')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'PR details' })).toBeNull();
  });

  it('opens the new pull request page from the header when the session has none', () => {
    h.state.sessionGithub = {
      [SESSION_ID]: { pr: null, detail: null, detailLoading: false, detailError: null },
    };
    render(<ReviewPane session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open pull request' }));

    expect(h.state.setPullRequestMode).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mode: 'create_pr',
    });
    expect(h.state.navigate).toHaveBeenCalled();
  });

  it('keeps the dock to the publication and links the pull request page from the header', () => {
    render(<ReviewPane session={SESSION} />);

    for (const name of [/Write review/, /PR details/, /PR activity/, /^Checks$/]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Open pull request #248' }));
    expect(h.state.setPullRequestMode).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mode: 'overview',
    });
  });
});
