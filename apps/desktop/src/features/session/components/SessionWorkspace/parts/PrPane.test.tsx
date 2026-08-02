import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  GhTokenStatus,
  IsoDateTime,
  PullRequestState,
  Session,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
  Workspace,
} from '@goodboy/types';

type Store = {
  sessionGithub: Record<string, unknown>;
  sessionGithubPrs: Record<string, ReadonlyArray<PullRequestState>>;
  sessionSelectedPrNumber: Record<string, number | null>;
  sessionGitlabMr: Record<string, unknown>;
  sessionExternalTasks: Record<string, ReadonlyArray<SessionExternalTask>>;
  sessionPhaseRuns: Record<string, ReadonlyArray<unknown>>;
  workspaceIntegrations: Record<string, ReadonlyArray<{ readonly provider: string }>>;
  readonly refreshSessionPr: ReturnType<typeof vi.fn>;
  readonly selectSessionPr: ReturnType<typeof vi.fn>;
  readonly sessionBranches: Record<string, string>;
  sessionMounts: Record<string, ReadonlyArray<never>>;
  sessionActiveMount: Record<string, WorkspaceId>;
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
  sessions: ReadonlyArray<Session>;
  workspaces: ReadonlyArray<Workspace>;
};

const h = vi.hoisted(() => ({
  store: {
    sessionGithub: {},
    sessionGithubPrs: {},
    sessionSelectedPrNumber: {},
    sessionGitlabMr: {},
    sessionExternalTasks: {},
    sessionPhaseRuns: {},
    workspaceIntegrations: {},
    refreshSessionPr: vi.fn(),
    selectSessionPr: vi.fn(),
    sessionBranches: { 'session-1': 'ak/refactor-auth' },
    sessionMounts: {},
    sessionActiveMount: {},
    sessionWorktrees: { 'session-1': ['/tmp/goodboy/.goodboy/worktrees/refactor-auth'] },
    sessions: [] as ReadonlyArray<Session>,
    workspaces: [] as ReadonlyArray<Workspace>,
  } satisfies Store,
  remoteKind: 'github' as 'github' | 'gitlab' | 'other' | null,
  onSelectLens: vi.fn(),
  githubStatus: {
    available: true,
    mode: 'gh-cli',
    user: 'akhayam',
    scoped: false,
  } as GhTokenStatus,
  ghStatus: vi.fn(),
  ghSetToken: vi.fn(),
  openUrl: vi.fn(async () => undefined),
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (state: Store) => T) => selector(h.store),
}));

vi.mock('../../../../worktree/useRemoteHostKind', () => ({
  useRemoteHostKind: () => h.remoteKind,
}));

vi.mock('../../../../../store/slices/worktrees/useSessionRepo', () => ({
  useSessionRepo: () => ({
    repoRoot: '/tmp/goodboy',
    worktreePath: '/tmp/goodboy/.goodboy/worktrees/refactor-auth',
    branch: 'ak/refactor-auth',
    mountName: null,
    workspaceId: 'workspace-1',
  }),
}));

vi.mock('../../../../context/components/ContextPanel/strips/GitlabMrStrip', () => ({
  GitlabMrStrip: ({ onOpenStudio }: { readonly onOpenStudio?: () => void }) => (
    <div>
      <div>GitLab merge request detail</div>
      <button type="button" onClick={onOpenStudio}>
        Open merge request from code host
      </button>
    </div>
  ),
}));

vi.mock('../../../../github/github', () => ({
  ghStatus: h.ghStatus,
  ghSetToken: h.ghSetToken,
  ghClearToken: vi.fn(async () => undefined),
}));

vi.mock('../../../../../shared/lib/editor', () => ({
  openUrl: h.openUrl,
}));

import { PrPane } from './PrPane';

const DATE = '2026-07-22T10:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'session-1' as SessionId;
const PULL_REQUEST = {
  number: 42,
  title: 'Refactor authentication',
  url: 'https://github.com/acme/goodboy/pull/42',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/refactor-auth',
  isDraft: false,
  reviewDecision: 'review_required',
  body: 'Refactors authentication.',
  updatedAt: DATE,
} satisfies PullRequestState;
const session: Session = {
  id: SESSION_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  goal: 'Refactor authentication',
  state: { kind: 'idle', lastActivityAt: DATE },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: DATE,
  updatedAt: DATE,
};

beforeEach(() => {
  h.store.sessionGithub = {};
  h.store.sessionGithubPrs = {};
  h.store.sessionSelectedPrNumber = {};
  h.store.sessionGitlabMr = {};
  h.store.sessionExternalTasks = {};
  h.store.sessionPhaseRuns = {};
  h.store.workspaceIntegrations = {};
  h.store.sessions = [session];
  h.store.workspaces = [
    {
      id: session.workspaceId,
      name: 'Goodboy',
      rootPath: '/tmp/goodboy',
      kind: 'repo',
      createdAt: DATE,
      updatedAt: DATE,
    },
  ];
  h.remoteKind = 'github';
  h.onSelectLens.mockReset();
  h.openUrl.mockClear();
  h.githubStatus = {
    available: true,
    mode: 'gh-cli',
    user: 'akhayam',
    scoped: false,
  };
  h.ghStatus.mockImplementation(async () => h.githubStatus);
  h.ghSetToken.mockImplementation(async () => {
    h.githubStatus = {
      available: true,
      mode: 'pat',
      user: 'akhayam',
      scoped: true,
    };
    return h.githubStatus;
  });
});

afterEach(cleanup);

describe('PrPane', () => {
  it('names the host it is actually pointed at', () => {
    h.remoteKind = 'gitlab';

    render(<PrPane session={session} onSelectLens={h.onSelectLens} />);

    expect(screen.getByRole('heading', { name: 'GitLab' })).toBeDefined();
    expect(
      screen.getByText('Linked issues and pull or merge request for this session.'),
    ).toBeDefined();
    expect(screen.queryByText('GitHub')).toBeNull();
  });

  it('names GitHub when that is the host', () => {
    h.remoteKind = 'github';

    render(<PrPane session={session} onSelectLens={h.onSelectLens} />);

    expect(screen.getByRole('heading', { name: 'GitHub' })).toBeDefined();
  });

  it('falls back to neutral copy when both hosts carry work', () => {
    h.store.sessionGithub = {
      [SESSION_ID]: {
        pr: PULL_REQUEST,
        detail: { checks: [], comments: [] },
        loading: false,
        error: null,
      },
    };
    h.store.sessionGithubPrs = { [SESSION_ID]: [PULL_REQUEST] };
    h.store.sessionGitlabMr = {
      [SESSION_ID]: { mr: { iid: 7, title: 'MR', state: 'open', draft: false } },
    };

    render(<PrPane session={session} onSelectLens={h.onSelectLens} />);

    expect(screen.getByRole('heading', { name: 'Code host work' })).toBeDefined();
  });

  it('never offers create-PR actions inside a PR review session', () => {
    h.store.sessionPhaseRuns = {
      [SESSION_ID]: [{ id: 'agent-1', name: 'pr review', kind: 'pr-reviewer' }],
    };

    render(<PrPane session={session} onSelectLens={h.onSelectLens} />);

    expect(screen.getByText('External review session')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Draft with agent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quick draft' })).toBeNull();
  });

  it('lands directly on the detail with a single pull request', () => {
    h.store.sessionGithub = {
      [SESSION_ID]: {
        pr: PULL_REQUEST,
        detail: { checks: [], comments: [] },
        loading: false,
        error: null,
      },
    };
    h.store.sessionGithubPrs = { [SESSION_ID]: [PULL_REQUEST] };

    render(<PrPane session={session} onSelectLens={h.onSelectLens} />);

    expect(
      screen.queryByRole('button', { name: /GitHub #42 Refactor authentication In review/i }),
    ).toBeNull();
    expect(screen.getAllByText('Refactor authentication')).toHaveLength(1);
    expect(screen.getByText('No CI')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open in code host' })).toBeDefined();
  });

  it('offers a switcher across every pull request on the branch', () => {
    const closedPr = {
      ...PULL_REQUEST,
      number: 40,
      title: 'Refactor authentication (superseded)',
      state: 'closed',
    } satisfies PullRequestState;
    h.store.sessionGithub = {
      [SESSION_ID]: {
        pr: PULL_REQUEST,
        detail: { checks: [], comments: [] },
        loading: false,
        error: null,
      },
    };
    h.store.sessionGithubPrs = { [SESSION_ID]: [PULL_REQUEST, closedPr] };

    render(<PrPane session={session} onSelectLens={h.onSelectLens} />);

    fireEvent.click(screen.getByRole('button', { name: /#42 of 2/i }));
    fireEvent.click(screen.getByRole('option', { name: /#40/i }));

    expect(h.store.selectSessionPr).toHaveBeenCalledWith(SESSION_ID, 40);
  });

  it('renders a valid selected pr without replacing the canonical pr', () => {
    const closedPr = {
      ...PULL_REQUEST,
      number: 40,
      title: 'Refactor authentication (superseded)',
      state: 'closed',
    } satisfies PullRequestState;
    h.store.sessionGithub = {
      [SESSION_ID]: {
        pr: PULL_REQUEST,
        detail: { checks: [], comments: [] },
        loading: false,
        error: null,
      },
    };
    h.store.sessionGithubPrs = { [SESSION_ID]: [PULL_REQUEST, closedPr] };
    h.store.sessionSelectedPrNumber = { [SESSION_ID]: closedPr.number };

    render(<PrPane session={session} onSelectLens={h.onSelectLens} />);

    expect(screen.getByText(closedPr.title)).toBeDefined();
    expect(screen.queryByText(PULL_REQUEST.title)).toBeNull();
  });

  it('falls back when the selected provider request disappears', () => {
    h.store.sessionGithub = {
      [SESSION_ID]: {
        pr: PULL_REQUEST,
        detail: { checks: [], comments: [] },
        loading: false,
        error: null,
      },
    };
    h.store.sessionGitlabMr = {
      [SESSION_ID]: {
        mr: {
          iid: 7,
          title: 'GitLab fallback candidate',
          state: 'open',
          draft: false,
        },
      },
    };
    const view = render(<PrPane session={session} onSelectLens={h.onSelectLens} />);

    fireEvent.click(screen.getByRole('button', { name: /GitLab !7/i }));
    expect(screen.getByText('GitLab merge request detail')).toBeDefined();

    h.store.sessionGitlabMr = {};
    view.rerender(<PrPane session={session} onSelectLens={h.onSelectLens} />);

    expect(screen.queryByText('GitLab merge request detail')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open in code host' })).toBeDefined();
  });

  it('shows PR status, linked issues, and code-host external tasks from stored state', () => {
    h.store.sessionGithub = {
      [SESSION_ID]: {
        pr: PULL_REQUEST,
        linkedIssues: [
          {
            number: 7,
            title: 'Track auth rollout',
            url: 'https://github.com/acme/goodboy/issues/7',
            closes: true,
          },
        ],
        detail: {
          checks: [{ name: 'test', conclusion: 'success', detailsUrl: null, durationMs: 1200 }],
          comments: [
            {
              id: 'comment-1',
              author: 'reviewer',
              authorAvatarUrl: null,
              body: 'Please add a regression test.',
              createdAt: DATE,
              url: 'https://github.com/acme/goodboy/pull/42#discussion_r1',
              source: 'review',
              resolved: false,
            },
          ],
        },
        loading: false,
        error: null,
      },
    };
    h.store.sessionExternalTasks = {
      [SESSION_ID]: [
        {
          sessionId: SESSION_ID,
          provider: 'github',
          externalId: '7',
          identifier: '#7',
          url: 'https://github.com/acme/goodboy/issues/7',
          title: 'Track auth rollout',
          createdAt: DATE,
        },
      ],
    };

    render(<PrPane session={session} onSelectLens={h.onSelectLens} />);

    expect(screen.getByText('CI passing')).toBeDefined();
    expect(screen.getByText('Review required')).toBeDefined();
    expect(screen.getByText('ak/refactor-auth')).toBeDefined();
    expect(screen.getByText('main')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByRole('button', { name: /#7 Track auth rollout/i })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'open #7 in GitHub' }));
    expect(h.openUrl).toHaveBeenCalledWith('https://github.com/acme/goodboy/issues/7');
    expect(h.onSelectLens).not.toHaveBeenCalled();
    expect(screen.getAllByRole('link', { name: 'Open in GitHub' })).toHaveLength(2);
  });

  it('shows repository attribution on composite linked rows', () => {
    const memberId = 'workspace-web' as WorkspaceId;
    h.store.workspaces = [
      {
        id: session.workspaceId,
        name: 'Product',
        rootPath: '/tmp/product',
        kind: 'composite',
        members: [{ workspaceId: memberId, rootPath: '/tmp/web', mountName: 'web' }],
        createdAt: DATE,
        updatedAt: DATE,
      },
    ];
    h.store.sessionGithub = {
      [SESSION_ID]: {
        pr: PULL_REQUEST,
        detail: { checks: [], comments: [] },
        loading: false,
        error: null,
      },
    };
    h.store.sessionExternalTasks = {
      [SESSION_ID]: [
        {
          sessionId: SESSION_ID,
          mountWorkspaceId: memberId,
          provider: 'github',
          externalId: '42',
          identifier: '#42',
          url: PULL_REQUEST.url,
          title: PULL_REQUEST.title,
          createdAt: DATE,
        },
      ],
    };

    render(<PrPane session={session} onSelectLens={h.onSelectLens} />);

    expect(screen.getByText('web')).toBeDefined();
  });

  it('keeps linked issues and external tasks visible without a pull request', () => {
    h.store.sessionGithub = {
      [SESSION_ID]: {
        pr: null,
        linkedIssues: [
          {
            number: 7,
            title: 'Track auth rollout',
            url: 'https://github.com/acme/goodboy/issues/7',
            closes: true,
          },
        ],
        detail: null,
        loading: false,
        error: null,
      },
    };
    h.store.sessionExternalTasks = {
      [SESSION_ID]: [
        {
          sessionId: SESSION_ID,
          provider: 'github',
          externalId: '9',
          identifier: '#9',
          url: 'https://github.com/acme/goodboy/issues/9',
          title: 'Harden token refresh',
          createdAt: DATE,
        },
      ],
    };

    render(<PrPane session={session} onSelectLens={h.onSelectLens} />);

    expect(screen.getByRole('button', { name: /#7 Track auth rollout/i })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /#7 Track auth rollout/i }));
    expect(h.openUrl).toHaveBeenCalledWith('https://github.com/acme/goodboy/issues/7');
    fireEvent.click(screen.getByRole('button', { name: 'open #9 in GitHub' }));
    expect(h.openUrl).toHaveBeenCalledWith('https://github.com/acme/goodboy/issues/9');
    expect(h.onSelectLens).not.toHaveBeenCalled();
    expect(screen.getByText('No pull or merge request yet')).toBeDefined();
    expect(screen.getByText('ak/refactor-auth')).toBeDefined();
    expect(screen.getByRole('button', { name: /Open in code host/i })).toBeDefined();

    expect(screen.queryByRole('region', { name: 'issue #7 details' })).toBeNull();
  });

  it('routes the open action to GitHub for GitHub sessions', () => {
    const githubEvents: Array<CustomEvent> = [];
    const gitlabEvents: Array<CustomEvent> = [];
    const githubListener = (event: Event) => githubEvents.push(event as CustomEvent);
    const gitlabListener = (event: Event) => gitlabEvents.push(event as CustomEvent);
    window.addEventListener('goodboy:open-github-session', githubListener);
    window.addEventListener('goodboy:open-gitlab-mr', gitlabListener);

    render(<PrPane session={session} onSelectLens={h.onSelectLens} />);
    const cta = screen.getByRole('button', { name: /Open in code host/i });
    fireEvent.click(cta);
    window.removeEventListener('goodboy:open-github-session', githubListener);
    window.removeEventListener('goodboy:open-gitlab-mr', gitlabListener);

    expect(githubEvents).toHaveLength(1);
    expect(githubEvents[0]?.detail).toEqual({ sessionId: SESSION_ID });
    expect(gitlabEvents).toHaveLength(0);
    expect(
      screen.getByText(/No issues or external tasks are linked to this session yet/),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Quick draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Draft with agent' })).toBeNull();
  });

  it('routes the open action to GitLab for GitLab sessions', () => {
    h.remoteKind = 'gitlab';
    const githubEvents: Array<CustomEvent> = [];
    const gitlabEvents: Array<CustomEvent> = [];
    const githubListener = (event: Event) => githubEvents.push(event as CustomEvent);
    const gitlabListener = (event: Event) => gitlabEvents.push(event as CustomEvent);
    window.addEventListener('goodboy:open-github-session', githubListener);
    window.addEventListener('goodboy:open-gitlab-mr', gitlabListener);

    render(<PrPane session={session} onSelectLens={h.onSelectLens} />);
    const cta = screen.getByRole('button', { name: 'Open merge request from code host' });
    fireEvent.click(cta);
    window.removeEventListener('goodboy:open-github-session', githubListener);
    window.removeEventListener('goodboy:open-gitlab-mr', gitlabListener);

    expect(gitlabEvents).toHaveLength(1);
    expect(gitlabEvents[0]?.detail).toEqual({ sessionId: SESSION_ID });
    expect(githubEvents).toHaveLength(0);
  });

  it('explains that a missing GitHub remote cannot be fixed with a token', () => {
    h.remoteKind = null;

    render(<PrPane session={session} onSelectLens={h.onSelectLens} />);
    expect(screen.getByRole('heading', { name: 'GitHub', level: 2 })).toBeDefined();
    expect(screen.getByText(/does not have a GitHub remote/i)).toBeDefined();
    expect(screen.queryByLabelText('GitHub personal access token')).toBeNull();
    expect(screen.queryByRole('button', { name: /Open in code host/i })).toBeNull();
  });

  it('clears the token empty state after connecting a repository with a GitHub remote', async () => {
    h.githubStatus = {
      available: true,
      mode: 'absent',
      scoped: false,
    };

    render(<PrPane session={session} onSelectLens={h.onSelectLens} />);
    const tokenInput = await screen.findByLabelText('GitHub personal access token');
    fireEvent.change(tokenInput, { target: { value: 'ghp_valid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => {
      expect(screen.queryByLabelText('GitHub personal access token')).toBeNull();
    });
    expect(screen.getByRole('button', { name: /Open in code host/i })).toBeDefined();
  });
});
