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
      subscribe: () => () => undefined,
    }),
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
    publish,
  }: {
    readonly header: React.ReactNode;
    readonly publish: React.ReactNode;
  }) => (
    <div data-testid="resolve-queue">
      {header}
      {publish}
    </div>
  ),
}));
vi.mock('../ReviewPane/WriteReview', () => ({
  WriteReview: ({ publishBar }: { readonly publishBar: React.ReactNode }) => (
    <div data-testid="write-review">{publishBar}</div>
  ),
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

describe('PullRequestPage', () => {
  it('names the action on a pull request lifecycle failure', async () => {
    h.state.markPrReady.mockRejectedValueOnce(new Error('branch is protected'));
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'PR actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Mark ready/ }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Mark #248 ready for review?' })).getByRole(
        'button',
        { name: 'Mark ready' },
      ),
    );

    await waitFor(() =>
      expect(h.state.reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't mark #248 ready", sessionId: SESSION.id }),
      ),
    );
    expect(h.showToast).not.toHaveBeenCalled();
  });

  it('says what marking a draft ready sends before it sends it', () => {
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'PR actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Mark ready/ }));

    expect(h.state.markPrReady).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: 'Mark #248 ready for review?' });
    expect(within(confirm).getByText(/cannot be unsent/)).toBeDefined();

    fireEvent.click(within(confirm).getByRole('button', { name: 'Mark ready' }));

    expect(h.state.markPrReady).toHaveBeenCalledWith(SESSION.id, 248);
  });

  it('names what closing sends to GitHub, and what survives it', () => {
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'PR actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Close/ }));

    expect(h.state.closePr).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: 'Close #248 without merging?' });
    expect(within(confirm).getByText(/The branch and its commits stay/)).toBeDefined();

    fireEvent.click(within(confirm).getByRole('button', { name: 'Close it' }));

    expect(h.state.closePr).toHaveBeenCalledWith(SESSION.id, 248);
  });

  it('names the branch pair the merge squashes, and what it leaves alone', () => {
    patchPr({ isDraft: false });
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'PR actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Merge/ }));

    expect(h.state.mergePr).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: 'Squash merge #248?' });
    expect(
      within(confirm).getByText(
        /Every commit on feature\/retry lands on main as one.*The branch is not deleted\./,
      ),
    ).toBeDefined();
  });

  it('refuses the merge before the press when the branch conflicts', () => {
    patchPr({ isDraft: false, mergeable: false });
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'PR actions' }));
    const merge = screen.getByRole('menuitem', { name: /^Merge/ }) as HTMLButtonElement;

    expect(merge.getAttribute('aria-disabled')).toBe('true');
    expect(merge.textContent).toContain('Resolve the conflicts with main first');

    fireEvent.click(merge);
    expect(screen.queryByRole('group', { name: 'Squash merge #248?' })).toBeNull();
  });

  it('draws an uncomputed mergeable as unknown rather than as the good case', () => {
    patchPr({ isDraft: false, mergeable: null, checks: 'pending' });
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'PR actions' }));
    const merge = screen.getByRole('menuitem', { name: /^Merge/ }) as HTMLButtonElement;

    expect(merge.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(merge);

    const confirm = screen.getByRole('group', { name: 'Squash merge #248?' });
    expect(
      within(confirm).getByText('GitHub has not finished checking whether this branch merges'),
    ).toBeDefined();
    expect(within(confirm).getByText('Checks are still running')).toBeDefined();
  });

  it('names what GitHub may still refuse on a mergeable pull request', () => {
    patchPr({ isDraft: false, mergeable: true, reviewDecision: 'review_required' });
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'PR actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Merge/ }));

    const confirm = screen.getByRole('group', { name: 'Squash merge #248?' });
    expect(within(confirm).getByText('GitHub can still refuse this merge')).toBeDefined();
    expect(within(confirm).getByText('A review is still requested')).toBeDefined();
  });

  it('holds back every write while another surface is already writing this pull request', () => {
    patchPr({ isDraft: false });
    h.state.prWriteClaims = {
      'project-1#248': {
        key: 'project-1#248',
        windowLabel: 'win-other',
        action: 'merge',
        startedAt: Date.now(),
      },
    };
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'PR actions' }));
    const merge = screen.getByRole('menuitem', { name: /^Merge/ }) as HTMLButtonElement;
    const close = screen.getByRole('menuitem', { name: /^Close/ }) as HTMLButtonElement;

    expect(merge.getAttribute('aria-disabled')).toBe('true');
    expect(close.getAttribute('aria-disabled')).toBe('true');
    expect(merge.textContent).toContain('Goodboy is already merging #248');
  });

  it('says why a merged pull request cannot merge again', () => {
    patchPr({ state: 'merged', isDraft: false });
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'PR actions' }));
    const merge = screen.getByRole('menuitem', { name: /^Merge/ }) as HTMLButtonElement;

    expect(merge.getAttribute('aria-disabled')).toBe('true');
    expect(merge.textContent).toContain('This pull request is already merged');
  });

  it('says a closed pull request has to come back before it merges', () => {
    patchPr({ state: 'closed', isDraft: false });
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'PR actions' }));
    const merge = screen.getByRole('menuitem', { name: /^Merge/ }) as HTMLButtonElement;

    expect(merge.getAttribute('aria-disabled')).toBe('true');
    expect(merge.textContent).toContain('Reopen this pull request before merging');
  });

  it('says GitHub already owns the merge once it is set to go', () => {
    patchPr({ state: 'queued', isDraft: false });
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'PR actions' }));
    const merge = screen.getByRole('menuitem', { name: /^Merge/ }) as HTMLButtonElement;

    expect(merge.getAttribute('aria-disabled')).toBe('true');
    expect(merge.textContent).toContain('GitHub is already set to merge this pull request');
  });

  it('backs out of a confirm without touching GitHub', () => {
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'PR actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Close/ }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Close #248 without merging?' })).getByRole(
        'button',
        { name: 'Cancel' },
      ),
    );

    expect(h.state.closePr).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'PR actions' })).toBeDefined();
  });

  it('points to Review with one call to action when conversations wait', () => {
    render(<PullRequestPage session={SESSION} />);

    expect(screen.getByText('1 conversation needs an answer')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Resolve in Review' }));
    expect(h.state.openReviewTarget).toHaveBeenCalledWith({ sessionId: SESSION_ID });
  });

  it('shows no call to action when nothing waits', () => {
    const github = h.state.sessionGithub[SESSION_ID] as { detail: Record<string, unknown> };
    h.state.sessionGithub = {
      [SESSION_ID]: { ...github, detail: { ...github.detail, comments: [] } },
    };
    render(<PullRequestPage session={SESSION} />);

    expect(screen.queryByRole('button', { name: 'Resolve in Review' })).toBeNull();
  });

  it('holds details, checks and activity on one page', () => {
    render(<PullRequestPage session={SESSION} />);

    expect(screen.getByRole('region', { name: 'PR details' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'PR activity' })).toBeDefined();
  });

  it('opens Write review as a child page and submits from the diff toolbar, not a footer bar', async () => {
    h.state.reviewDrafts = {
      [SESSION_ID]: [{ id: 'draft-1', status: 'draft' } as unknown as never],
    };
    const { container } = render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Write review (1)' }));
    expect(h.state.pullRequestModes[SESSION_ID]).toBe('write_review');
    const writeReview = screen.getByTestId('write-review');
    expect(within(writeReview).getByRole('button', { name: 'Submit review' })).toBeDefined();
    expect(container.querySelector('[data-slot="pane-dock"]')).toBeNull();

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
    const { unmount } = render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Write review' }));
    unmount();

    expect(h.state.pullRequestModes[SESSION_ID]).toBe('overview');
  });

  it('never opens a dialog on any primary path', () => {
    render(<PullRequestPage session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'Write review' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
