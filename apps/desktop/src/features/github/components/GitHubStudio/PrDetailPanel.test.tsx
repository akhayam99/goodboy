import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { PrDetail, PullRequestState, SessionId, WorkspaceId } from '@goodboy/types';

type Store = {
  readonly sessions: ReadonlyArray<{
    readonly id: SessionId;
    readonly workspaceId: WorkspaceId;
    readonly goal: string;
  }>;
  readonly workspaces: ReadonlyArray<{
    readonly id: WorkspaceId;
    readonly rootPath: string;
  }>;
  readonly sessionGithub: Record<
    string,
    {
      readonly pr: PullRequestState | null;
      readonly detail: PrDetail | null;
      readonly detailLoading: boolean;
      readonly detailError: string | null;
    }
  >;
  readonly sessionGithubPrs: Record<string, ReadonlyArray<PullRequestState>>;
  readonly sessionSelectedPrNumber: Record<string, number | null>;
  readonly sessionBranches: Record<string, string>;
  readonly refreshSessionPrDetail: ReturnType<typeof vi.fn>;
  readonly refreshSessionPr: ReturnType<typeof vi.fn>;
  readonly selectSessionPr: ReturnType<typeof vi.fn>;
  readonly markPrReady: ReturnType<typeof vi.fn>;
  readonly convertPrToDraft: ReturnType<typeof vi.fn>;
  readonly mergePr: ReturnType<typeof vi.fn>;
  readonly closePr: ReturnType<typeof vi.fn>;
  readonly reopenPr: ReturnType<typeof vi.fn>;
  readonly requestReview: ReturnType<typeof vi.fn>;
  readonly editPr: ReturnType<typeof vi.fn>;
  readonly spawnAgent: ReturnType<typeof vi.fn>;
  readonly selectAgent: ReturnType<typeof vi.fn>;
  readonly setCurrentSession: ReturnType<typeof vi.fn>;
  readonly setActiveLens: ReturnType<typeof vi.fn>;
  readonly activateNextResolver: ReturnType<typeof vi.fn>;
  readonly setAgentConfig: ReturnType<typeof vi.fn>;
};

const h = vi.hoisted(() => {
  const sessionId = 'session-1' as SessionId;
  const workspaceId = 'workspace-1' as WorkspaceId;
  const pr = {
    number: 42,
    title: 'Bring pull requests onto shared chrome',
    url: 'https://github.com/goodboy/goodboy/pull/42',
    state: 'open',
    mergeable: true,
    checks: 'success',
    baseBranch: 'main',
    headBranch: 'ak/shared-pr-chrome',
    isDraft: false,
    reviewDecision: null,
    body: 'Use the shared studio identity treatment.',
    updatedAt: '2026-07-30T10:00:00Z',
  } satisfies PullRequestState;
  const secondPr = {
    ...pr,
    number: 43,
    title: 'Follow-up pull request',
    url: 'https://github.com/goodboy/goodboy/pull/43',
  } satisfies PullRequestState;
  const detail = {
    prNumber: pr.number,
    comments: [],
    reviews: [],
    reviewRequests: [],
    checks: [],
  } satisfies PrDetail;

  return {
    sessionId,
    pr,
    secondPr,
    detail,
    prs: [] as ReadonlyArray<PullRequestState>,
    store: {
      sessions: [
        {
          id: sessionId,
          workspaceId,
          goal: 'Improve the PR studio',
        },
      ],
      workspaces: [{ id: workspaceId, rootPath: '/repo' }],
      sessionGithub: {
        [sessionId]: {
          pr,
          detail,
          detailLoading: false,
          detailError: null,
        },
      },
      sessionGithubPrs: { [sessionId]: [pr] },
      sessionSelectedPrNumber: {},
      sessionBranches: { [sessionId]: pr.headBranch },
      refreshSessionPrDetail: vi.fn(async () => undefined),
      refreshSessionPr: vi.fn(async () => undefined),
      selectSessionPr: vi.fn(async () => undefined),
      markPrReady: vi.fn(async () => undefined),
      convertPrToDraft: vi.fn(async () => undefined),
      mergePr: vi.fn(async () => undefined),
      closePr: vi.fn(async () => undefined),
      reopenPr: vi.fn(async () => undefined),
      requestReview: vi.fn(async () => undefined),
      editPr: vi.fn(async () => undefined),
      spawnAgent: vi.fn(async () => 'agent-1'),
      selectAgent: vi.fn(async () => undefined),
      setCurrentSession: vi.fn(async () => undefined),
      setActiveLens: vi.fn(),
      activateNextResolver: vi.fn(async () => undefined),
      setAgentConfig: vi.fn(async () => undefined),
    } satisfies Store,
  };
});

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) => selector(h.store),
  useCurrentWorkspace: () => h.store.workspaces[0] ?? null,
  useSessions: () => h.store.sessions,
}));

vi.mock('../../github', () => ({
  ghPrDetailByNumber: vi.fn(async () => h.detail),
  ghPrsForBranch: vi.fn(async () => h.prs),
  ghRepoCollaborators: vi.fn(async () => []),
}));

vi.mock('../../../session/hooks/useResolverIndex', () => ({
  useResolverIndex: () => ({
    links: [],
    byThreadId: new Map(),
    byCommentUrl: new Map(),
    byDiffAgentId: new Map(),
  }),
}));

vi.mock('../../../../shared/hooks/useSessionRoleModels', () => ({
  useSessionRoleModels: () => null,
}));

vi.mock('./PrActionBar', () => ({
  PrActionBar: () => <div>Pull request actions</div>,
}));

vi.mock('./PrConversation', () => ({
  PrConversation: () => <div>Conversation body</div>,
}));

vi.mock('./ResolveBoard', () => ({
  ResolveBoard: () => <div>Resolve body</div>,
}));

vi.mock('./PrChecks', () => ({
  PrChecks: () => <div>Checks body</div>,
}));

vi.mock('./CreatePrPanel', () => ({
  CreatePrPanel: () => <div>Create pull request</div>,
}));

import { PrDetailPanel } from './PrDetailPanel';

const renderPanel = () => render(<PrDetailPanel sessionId={h.sessionId} onClose={vi.fn()} />);

beforeEach(() => {
  h.prs = [h.pr];
  h.store.sessionGithubPrs = { [h.sessionId]: [h.pr] };
  h.store.sessionSelectedPrNumber = {};
  h.store.selectSessionPr.mockClear();
});

afterEach(cleanup);

describe('PrDetailPanel', () => {
  it('renders the title in the header band and a read-only editable field', () => {
    renderPanel();

    expect(screen.getByText('#42')).toBeDefined();
    expect(screen.getByRole('heading', { name: h.pr.title })).toBeDefined();

    const titleField = screen.getByRole('button', { name: h.pr.title });
    expect(titleField.closest('h1, h2, h3, h4, h5, h6')).toBeNull();
    fireEvent.click(titleField);

    expect(screen.getByDisplayValue(h.pr.title).tagName).toBe('INPUT');
  });

  it('switches the active section body through the tablist', () => {
    renderPanel();

    const tablist = screen.getByRole('tablist', { name: 'Pull request sections' });
    expect(
      within(tablist)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Overview', 'Conversation', 'Resolve', 'Checks']);
    expect(
      within(tablist).getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByText(h.pr.body)).toBeDefined();

    fireEvent.click(within(tablist).getByRole('tab', { name: 'Conversation' }));

    expect(
      within(tablist).getByRole('tab', { name: 'Conversation' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.queryByText(h.pr.body)).toBeNull();
    expect(screen.getByText('Conversation body')).toBeDefined();
  });

  it('shows the pull request switcher only when multiple pull requests are available', async () => {
    const firstRender = renderPanel();

    expect(screen.queryByTitle('2 pull requests on this branch')).toBeNull();

    firstRender.unmount();
    h.store.sessionGithubPrs = { [h.sessionId]: [h.pr, h.secondPr] };
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTitle('2 pull requests on this branch')).toBeDefined();
    });
  });

  it('selects the requested pull request even without a comment thread', () => {
    h.store.sessionGithubPrs = { [h.sessionId]: [h.pr, h.secondPr] };

    render(
      <PrDetailPanel
        sessionId={h.sessionId}
        initialPrNumber={h.secondPr.number}
        onClose={vi.fn()}
      />,
    );

    expect(h.store.selectSessionPr).toHaveBeenCalledWith(h.sessionId, h.secondPr.number);
  });

  it('drives the active pr and switcher selection through store state', () => {
    h.store.sessionGithubPrs = { [h.sessionId]: [h.pr, h.secondPr] };
    h.store.sessionSelectedPrNumber = { [h.sessionId]: h.secondPr.number };

    renderPanel();

    expect(screen.getByRole('heading', { name: h.secondPr.title })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /#43 of 2/i }));
    fireEvent.click(screen.getByRole('option', { name: /#42/i }));
    expect(h.store.selectSessionPr).toHaveBeenCalledWith(h.sessionId, h.pr.number);
  });
});
