import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  IsoDateTime,
  PullRequestState,
  Session,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
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
  } satisfies Store,
  remoteKind: 'github' as 'github' | 'gitlab' | 'other' | null,
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (state: Store) => T) => selector(h.store),
}));

vi.mock('../../../../worktree/useRemoteHostKind', () => ({
  useRemoteHostKind: () => h.remoteKind,
}));

vi.mock('../../../../context/components/ContextPanel/strips/GitlabMrStrip', () => ({
  GitlabMrStrip: () => <div>GitLab merge request detail</div>,
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
  h.remoteKind = 'github';
});

afterEach(cleanup);

describe('PrPane', () => {
  it('never offers create-PR actions inside a PR review session', () => {
    h.store.sessionPhaseRuns = {
      [SESSION_ID]: [{ id: 'agent-1', name: 'pr review', kind: 'pr-reviewer' }],
    };

    render(<PrPane session={session} />);

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

    render(<PrPane session={session} />);

    expect(
      screen.queryByRole('button', { name: /GitHub #42 Refactor authentication In review/i }),
    ).toBeNull();
    expect(screen.getAllByText('Refactor authentication')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Open PR' })).toBeDefined();
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

    render(<PrPane session={session} />);

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

    render(<PrPane session={session} />);

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
    const view = render(<PrPane session={session} />);

    fireEvent.click(screen.getByRole('button', { name: /GitLab !7/i }));
    expect(screen.getByText('GitLab merge request detail')).toBeDefined();

    h.store.sessionGitlabMr = {};
    view.rerender(<PrPane session={session} />);

    expect(screen.queryByText('GitLab merge request detail')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open PR' })).toBeDefined();
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

    render(<PrPane session={session} />);

    expect(screen.getByText('CI passing')).toBeDefined();
    expect(screen.getByText('Review required')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByRole('button', { name: /#7 Track auth rollout/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /open #7 in GitHub studio/i })).toBeDefined();
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

    render(<PrPane session={session} />);

    expect(screen.getByRole('button', { name: /#7 Track auth rollout/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /open #9 in GitHub studio/i })).toBeDefined();
    expect(screen.getByText('No pull request yet')).toBeDefined();
    expect(screen.getByText('ak/refactor-auth')).toBeDefined();
    expect(screen.getByRole('button', { name: /Open a pull request/i })).toBeDefined();

    const studioEvents: Array<CustomEvent> = [];
    const studioListener = (event: Event) => studioEvents.push(event as CustomEvent);
    const prListener = vi.fn();
    window.addEventListener('goodboy:open-github-studio', studioListener);
    window.addEventListener('goodboy:open-github-session', prListener);
    fireEvent.click(screen.getByRole('button', { name: /#7 Track auth rollout/i }));
    window.removeEventListener('goodboy:open-github-studio', studioListener);
    window.removeEventListener('goodboy:open-github-session', prListener);

    expect(studioEvents[0]?.detail).toEqual({ sessionId: SESSION_ID, issueExternalId: '7' });
    expect(prListener).not.toHaveBeenCalled();
  });

  it('routes creating a PR to the shared PR studio surface', () => {
    const events: Array<CustomEvent> = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    window.addEventListener('goodboy:open-github-session', listener);

    render(<PrPane session={session} />);
    const cta = screen.getByRole('button', { name: /Open a pull request/i });
    fireEvent.click(cta);
    window.removeEventListener('goodboy:open-github-session', listener);

    expect(events).toHaveLength(1);
    expect(events[0]?.detail).toEqual({ sessionId: SESSION_ID });
    expect(
      screen.getByText('No issues or external tasks are linked to this session yet.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Quick draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Draft with agent' })).toBeNull();
  });

  it('offers a connect action instead of the create-PR state without a GitHub remote', () => {
    h.remoteKind = null;
    const listener = vi.fn();
    window.addEventListener('goodboy:open-github-studio', listener);

    render(<PrPane session={session} />);
    expect(screen.getByText('Connect GitHub')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Open a pull request/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    window.removeEventListener('goodboy:open-github-studio', listener);

    expect(listener).toHaveBeenCalledOnce();
  });
});
