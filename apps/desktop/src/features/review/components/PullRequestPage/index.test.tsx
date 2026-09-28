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
    githubStatus: { mode: 'gh-cli', available: true, user: 'mara-l' } as Record<string, unknown>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
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
    openReviewTarget: vi.fn(async () => ({ kind: 'opened' as const })),
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
    useAppStore: Object.assign(useAppStore, {
      getState: () => h.state,
      subscribe: (listener: () => void) => {
        h.listeners.add(listener);
        return () => {
          h.listeners.delete(listener);
        };
      },
    }),
    useCurrentWorkspace: () => ({ id: 'workspace-1', name: 'goodboy' }),
    useDiffComments: (sessionId: string) => h.state.diffComments[sessionId] ?? [],
    useMountDiffStats: () => new Map(),
    useSessionById: () => ({ id: 'session-1', workspaceId: 'workspace-1' }),
    sessionPlace: (params: Record<string, unknown>) => ({ kind: 'session', ...params }),
  };
});
vi.mock('../../../../store/slices/github/activeProjectPrs', () => ({
  selectActiveProjectPrs: () => h.state.branchPrs,
}));
vi.mock('../../../../store/slices/worktrees/resolveSessionRepo', () => ({
  resolveSessionRepo: () => ({ projectId: 'project-1' }),
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
vi.mock('../ReviewPane/WriteReview', () => ({
  WriteReview: () => <div data-testid="write-review" />,
}));
vi.mock('../../../../shared/lib/editor', () => ({ openUrl: vi.fn(async () => undefined) }));

import { PullRequestPage } from './index';

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
        author: 'mara-l',
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
  h.state.githubStatus = { mode: 'gh-cli', available: true, user: 'mara-l' };
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

const READY = { isDraft: false, mergeable: true, checks: 'success', reviewDecision: 'approved' };

const notify = () => {
  for (const listener of h.listeners) {
    listener();
  }
};

describe('PullRequestPage', () => {
  it('offers Mark ready as the one next step on a draft, and runs it at once', async () => {
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mark ready for review' }));

    await waitFor(() => expect(h.state.markPrReady).toHaveBeenCalledWith(SESSION.id, 248));
    expect(screen.queryByRole('button', { name: 'Squash and merge' })).toBeNull();
  });

  it('says a failure under the control and retries it from there', async () => {
    h.state.markPrReady.mockRejectedValueOnce(new Error('branch is protected'));
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mark ready for review' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('branch is protected');
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(h.state.markPrReady).toHaveBeenCalledTimes(2));
  });

  it('makes Squash and merge the primary once approved and green, behind an inline confirm', async () => {
    patchPr(READY);
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Squash and merge' }));

    expect(h.state.mergePr).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: 'Squash and merge #248 into main?' });
    expect(
      within(confirm).getByText(/Every commit on feature\/retry lands on main as one/),
    ).toBeDefined();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Squash and merge' }));

    await waitFor(() => expect(h.state.mergePr).toHaveBeenCalledWith(SESSION.id, 248, 'squash'));
  });

  it('backs out of the merge confirm without touching GitHub', () => {
    patchPr(READY);
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Squash and merge' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Squash and merge #248 into main?' })).getByRole(
        'button',
        { name: 'Cancel' },
      ),
    );

    expect(h.state.mergePr).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Squash and merge #248 into main?' })).toBeNull();
  });

  it('keeps Merge visible and disabled with its reason while the branch conflicts', () => {
    patchPr({ ...READY, mergeable: false });
    render(<PullRequestPage session={SESSION} />);

    const merge = screen.getByRole('button', { name: 'Squash and merge' }) as HTMLButtonElement;
    expect(merge.disabled).toBe(true);
    expect(screen.getByText('Conflicts with main. Rebase in the Diff.')).toBeDefined();
  });

  it('names the failing check on the disabled Merge', () => {
    patchPr({ ...READY, checks: 'failure' });
    const github = h.state.sessionGithub[SESSION_ID] as { detail: Record<string, unknown> };
    h.state.sessionGithub = {
      [SESSION_ID]: {
        ...github,
        detail: {
          ...github.detail,
          checks: [
            { name: 'unit tests', conclusion: 'failure', detailsUrl: null, durationMs: 1000 },
          ],
        },
      },
    };
    render(<PullRequestPage session={SESSION} />);

    expect(screen.getByText('1 check failing: unit tests.')).toBeDefined();
  });

  it('holds back every write while another surface is already writing this pull request', () => {
    patchPr(READY);
    h.state.prWriteClaims = {
      'project-1#248': {
        key: 'project-1#248',
        windowLabel: 'win-other',
        action: 'merge',
        startedAt: Date.now(),
      },
    };
    render(<PullRequestPage session={SESSION} />);

    const merge = screen.getByRole('button', { name: 'Squash and merge' }) as HTMLButtonElement;
    expect(merge.disabled).toBe(true);
    expect(screen.getByText('Goodboy is already merging #248.')).toBeDefined();
  });

  it('hides Merge on a merged pull request and keeps GitHub', () => {
    patchPr({ state: 'merged', isDraft: false });
    render(<PullRequestPage session={SESSION} />);

    expect(screen.queryByRole('button', { name: 'Squash and merge' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open on GitHub' })).toBeDefined();
  });

  it('offers Reopen on a closed pull request', async () => {
    patchPr({ state: 'closed', isDraft: false });
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    await waitFor(() => expect(h.state.reopenPr).toHaveBeenCalledWith(SESSION.id, 248));
  });

  it('lists every action in the menu, grouped, the buttoned ones included', () => {
    patchPr(READY);
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Pull request actions' }));
    const labels = screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');

    expect(labels.some((label) => label.startsWith('Open on GitHub'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Squash and merge'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Convert to draft'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Close pull request'))).toBe(true);
  });

  it('points to Review with a quiet line when comments wait', () => {
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: /1 comment to resolve/ }));
    expect(h.state.openReviewTarget).toHaveBeenCalledWith({ sessionId: SESSION_ID });
  });

  it('shows no Review line when nothing waits', () => {
    const github = h.state.sessionGithub[SESSION_ID] as { detail: Record<string, unknown> };
    h.state.sessionGithub = {
      [SESSION_ID]: { ...github, detail: { ...github.detail, comments: [] } },
    };
    render(<PullRequestPage session={SESSION} />);

    expect(screen.queryByRole('button', { name: /to resolve/ })).toBeNull();
  });

  it('shows the pull request only: details, no activity and no fix', () => {
    render(<PullRequestPage session={SESSION} />);

    expect(screen.getByRole('region', { name: 'PR details' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'PR activity' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Fix/ })).toBeNull();
  });

  it('hides Write review on your own pull request', () => {
    patchPr({ isDraft: false });
    render(<PullRequestPage session={SESSION} />);

    expect(screen.queryByRole('button', { name: 'Write review' })).toBeNull();
  });

  it("opens Write review on someone else's pull request and submits from its dock", async () => {
    patchPr({ isDraft: false, author: 'kenji-w' });
    h.state.reviewDrafts = {
      [SESSION_ID]: [{ id: 'draft-1', status: 'draft' } as unknown as never],
    };
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Write review' }));
    notify();
    expect(h.state.pullRequestModes[SESSION_ID]).toBe('write_review');
    expect(await screen.findByTestId('write-review')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(h.state.publishPrReview).toHaveBeenCalledTimes(1));
  });

  it('shows the new pull request form when the session has none', () => {
    h.state.sessionGithub = {
      [SESSION_ID]: { pr: null, detail: null, detailLoading: false, detailError: null },
    };
    render(<PullRequestPage session={SESSION} />);

    expect(screen.getByTestId('create-pr')).toBeDefined();
  });

  it('drops back to the page overview when it unmounts', () => {
    h.state.pullRequestModes = { [SESSION_ID]: 'write_review' };
    const { unmount } = render(<PullRequestPage session={SESSION} />);

    unmount();

    expect(h.state.pullRequestModes[SESSION_ID]).toBe('overview');
  });

  it('never opens a dialog on any primary path', () => {
    patchPr(READY);
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Squash and merge' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
