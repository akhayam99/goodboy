// @vitest-environment happy-dom

import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';

type Store = {
  sessions: ReadonlyArray<Session>;
  workspaces: ReadonlyArray<unknown>;
  projects: ReadonlyArray<{ id: string; workspaceId: string; kind?: string; name?: string }>;
  sessionBranches: Record<string, string>;
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
  sessionProjectMounts: Record<string, ReadonlyArray<unknown>>;
  sessionActiveProject: Record<string, string>;
  sessionGithub: Record<
    string,
    {
      pr?: {
        number: number;
        state: 'draft' | 'open' | 'approved' | 'queued' | 'merged' | 'closed';
        isDraft: boolean;
        checks: 'success' | 'failure' | 'pending' | null;
        reviewDecision?: 'approved' | 'changes_requested' | null;
      } | null;
      linkedIssues?: ReadonlyArray<unknown>;
    }
  >;
  sessionGitlabMr: Record<string, { mr?: unknown }>;
  sessionExternalTasks: Record<string, ReadonlyArray<unknown>>;
  sessionTelemetry: Record<string, ReadonlyArray<unknown>>;
  sessionPhaseRuns: Record<string, ReadonlyArray<unknown>>;
  pendingTitleFocusSessionId: string | null;
  markAllAgentsSeen: ReturnType<typeof vi.fn>;
  renameTask: ReturnType<typeof vi.fn>;
  setFocusedGithubIssueNumber: ReturnType<typeof vi.fn>;
  openExternalTaskLens: ReturnType<typeof vi.fn>;
  openMountDiff: ReturnType<typeof vi.fn>;
  clearPendingTitleFocus: ReturnType<typeof vi.fn>;
  setSessionActiveProject: ReturnType<typeof vi.fn>;
  detachProject: ReturnType<typeof vi.fn>;
  materializeProject: ReturnType<typeof vi.fn>;
  emitNotification: ReturnType<typeof vi.fn>;
};

const { store, hooks, stats, summarizer, worktreeMocks } = vi.hoisted(() => ({
  worktreeMocks: {
    worktreeStatus: vi.fn(async () => ({}) as unknown),
  },
  store: {
    sessions: [] as ReadonlyArray<Session>,
    workspaces: [] as ReadonlyArray<unknown>,
    projects: [] as ReadonlyArray<{
      id: string;
      workspaceId: string;
      kind?: string;
      name?: string;
    }>,
    sessionBranches: {} as Record<string, string>,
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    sessionProjectMounts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionActiveProject: {} as Record<string, string>,
    sessionGithub: {} as Store['sessionGithub'],
    sessionGitlabMr: {} as Record<string, { mr?: unknown }>,
    sessionExternalTasks: {} as Record<string, ReadonlyArray<unknown>>,
    sessionTelemetry: {} as Record<string, ReadonlyArray<unknown>>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    pendingTitleFocusSessionId: null as string | null,
    markAllAgentsSeen: vi.fn(async () => undefined),
    renameTask: vi.fn(async () => undefined),
    setFocusedGithubIssueNumber: vi.fn(),
    openExternalTaskLens: vi.fn(),
    openMountDiff: vi.fn(),
    clearPendingTitleFocus: vi.fn(),
    setSessionActiveProject: vi.fn(),
    detachProject: vi.fn(async () => undefined),
    materializeProject: vi.fn(async () => undefined),
    emitNotification: vi.fn(),
  } as Store,
  hooks: {
    remoteKind: { current: 'github' as 'github' | 'gitlab' | 'other' | 'none' | null },
  },
  stats: {
    current: new Map<string, { additions: number; deletions: number }>(),
  },
  summarizer: {
    current: { status: 'idle', error: null, lastAttempt: null } as {
      status: string;
      error: string | null;
      lastAttempt: number | null;
    },
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  agentHasUnread: () => false,
  useAppStore: <T,>(selector: (s: Store) => T) => selector(store),
  useCurrentWorkspace: () => null,
  useMountDiffStats: () => stats.current,
  useSummarizerStatus: () => summarizer.current,
}));

vi.mock('../../../worktree/BranchSwitchPanel', () => ({
  BranchSwitchPanel: () => <div data-testid="branch-switch-panel" />,
}));

vi.mock('../SummarizerBadge', () => ({
  SummarizerBadge: () => <span data-testid="summarizer-badge" />,
}));

vi.mock('../../../../app/components/Toast', () => {
  const showToast = vi.fn();
  return { useToast: () => ({ showToast }) };
});

vi.mock('../../../worktree/useRemoteHostKind', () => ({
  useRemoteHostKind: () => hooks.remoteKind.current,
}));

vi.mock('../../../worktree/worktree', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../worktree/worktree')>();
  return { ...actual, worktreeStatus: worktreeMocks.worktreeStatus };
});

const editorMenuCalls: Array<{ sessionId: string; density?: string }> = [];
const sessionGitActionsCalls: Array<{ sessionId: string; density?: string }> = [];
const sessionDestructiveActionsCalls: Array<{ sessionId: string }> = [];

vi.mock('./EditorMenu', () => ({
  EditorMenu: ({ sessionId, density }: { sessionId: string; density?: string }) => {
    editorMenuCalls.push({ sessionId, density });
    return <button type="button" aria-label="open worktree" />;
  },
}));

vi.mock('../SessionWorkspace/parts/SessionGitActions', () => ({
  SessionGitActions: ({ session, density }: { session: { id: string }; density?: string }) => {
    sessionGitActionsCalls.push({ sessionId: session.id, density });
    return <button type="button" aria-label="branch actions" />;
  },
}));

vi.mock('./LinkIssueAction', () => ({
  LinkIssueAction: ({
    presentation,
    isCollapsed,
  }: {
    presentation?: 'icon' | 'chip';
    isCollapsed?: boolean;
  }) => (
    <button
      type="button"
      aria-label="Link an issue"
      data-presentation={presentation ?? 'icon'}
      data-collapsed={isCollapsed === true ? 'true' : 'false'}
    />
  ),
}));

vi.mock('./SessionDestructiveActions', () => ({
  SessionDestructiveActions: ({ session }: { session: { id: string } }) => {
    sessionDestructiveActionsCalls.push({ sessionId: session.id });
    return <button type="button" aria-label="session actions" />;
  },
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    Tooltip: ({ content, children }: { content: string; children: ReactElement }) => (
      <span data-tooltip={content}>{children as ReactNode}</span>
    ),
  };
});

import { HeaderBand } from './HeaderBand';

const SESSION_ID = 'sess-1' as SessionId;

const GOAL_STUB = <section aria-label="Goal" data-testid="goal-region" />;

const mountApiProject = () => {
  store.projects = [{ id: 'project-1', workspaceId: 'ws-1', kind: 'repo', name: 'api' }];
  store.sessionProjectMounts = {
    [SESSION_ID]: [
      {
        projectId: 'project-1',
        mountName: 'api',
        branch: 'goodboy/x',
        worktreePath: '/worktrees/api',
      },
    ],
  };
};

const baseSession = (): Session =>
  ({
    id: SESSION_ID,
    workspaceId: 'ws-1',
    goal: 'refactor auth',
    state: { kind: 'idle' },
    createdAt: '2026-06-22T10:00:00.000Z',
    workflowRuns: [],
  }) as unknown as Session;

beforeEach(() => {
  summarizer.current = { status: 'idle', error: null, lastAttempt: null };
  store.sessions = [];
  store.workspaces = [];
  store.projects = [];
  store.sessionBranches = {};
  store.sessionWorktrees = {};
  store.sessionProjectMounts = {};
  store.sessionActiveProject = {};
  store.sessionGithub = {};
  store.sessionGitlabMr = {};
  store.sessionExternalTasks = {};
  store.sessionTelemetry = {};
  store.sessionPhaseRuns = {};
  store.pendingTitleFocusSessionId = null;
  store.markAllAgentsSeen.mockReset();
  store.renameTask.mockReset();
  store.setFocusedGithubIssueNumber.mockReset();
  store.openExternalTaskLens.mockReset();
  store.openMountDiff.mockReset();
  store.clearPendingTitleFocus.mockReset();
  store.setSessionActiveProject.mockReset();
  store.detachProject.mockReset();
  store.materializeProject.mockReset();
  store.emitNotification.mockReset();
  stats.current = new Map();
  worktreeMocks.worktreeStatus.mockReset();
  hooks.remoteKind.current = 'github';
  editorMenuCalls.length = 0;
  sessionGitActionsCalls.length = 0;
  sessionDestructiveActionsCalls.length = 0;
});
afterEach(cleanup);

describe('HeaderBand', () => {
  it('shows the stage nowhere in the header', () => {
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);
    for (const label of ['needs you', 'running', 'in review', 'building', 'done']) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it('keeps the PR create action in the project row when no PR exists', () => {
    mountApiProject();
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);
    expect(screen.getByRole('button', { name: /open pull request/i })).toBeDefined();
  });

  it('offers a merge-request creation action when the remote is GitLab', () => {
    mountApiProject();
    hooks.remoteKind.current = 'gitlab';
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);
    expect(screen.getByRole('button', { name: /open merge request/i })).toBeDefined();
  });

  it('dispatches the GitHub studio event when the create action fires', () => {
    mountApiProject();
    const events: Array<CustomEvent> = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    window.addEventListener('goodboy:open-github-session', listener);
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);
    fireEvent.click(screen.getByRole('button', { name: /open pull request/i }));
    window.removeEventListener('goodboy:open-github-session', listener);
    expect(events[0]?.detail).toEqual({ sessionId: SESSION_ID });
  });

  it('inlines the pull request chip in the project row when a PR exists', () => {
    mountApiProject();
    store.sessionGithub = {
      [SESSION_ID]: {
        pr: {
          number: 42,
          state: 'open',
          isDraft: false,
          checks: 'success',
          reviewDecision: null,
        },
      },
    };
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);
    expect(screen.getByRole('button', { name: 'Open PR #42' })).toBeDefined();
  });

  it('renders a linked work chip that navigates to the github issue lens', () => {
    store.sessionGithub = {
      [SESSION_ID]: {
        linkedIssues: [
          { number: 7, title: 'Broken auth', url: 'https://github.com/acme/repo/issues/7' },
        ],
      },
    };
    const onSelectLens = vi.fn();
    render(<HeaderBand session={baseSession()} onSelectLens={onSelectLens} goal={GOAL_STUB} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open issue #7' }));
    expect(store.setFocusedGithubIssueNumber).toHaveBeenCalledWith(SESSION_ID, 7);
    expect(onSelectLens).toHaveBeenCalledWith('github_issue');
  });

  it('stacks title, context and goal rows and skips the project row without projects', () => {
    const { container } = render(
      <HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />,
    );
    const band = container.firstElementChild;

    expect(band?.children).toHaveLength(3);
    expect(band?.children[1]?.contains(screen.getByRole('button', { name: 'Context' }))).toBe(true);
    expect(band?.children[2]?.getAttribute('data-testid')).toBe('goal-region');
  });

  it('pins the row order to title, context, project, goal', () => {
    mountApiProject();
    const { container } = render(
      <HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />,
    );
    const band = container.firstElementChild;

    expect(band?.children).toHaveLength(4);
    expect(band?.children[0]?.querySelector('h1')?.textContent).toBe('refactor auth');
    expect(band?.children[1]?.contains(screen.getByRole('button', { name: 'Context' }))).toBe(true);
    expect(band?.children[2]?.contains(screen.getByRole('button', { name: 'api' }))).toBe(true);
    expect(band?.children[3]?.getAttribute('data-testid')).toBe('goal-region');
  });

  it('seats the linked work and the link affordance on the context row', () => {
    store.sessionGithub = {
      [SESSION_ID]: {
        linkedIssues: [
          { number: 7, title: 'Broken auth', url: 'https://github.com/acme/repo/issues/7' },
        ],
      },
    };
    const { container } = render(
      <HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />,
    );
    const contextRow = container.firstElementChild?.children[1];

    expect(contextRow?.contains(screen.getByRole('button', { name: 'Context' }))).toBe(true);
    expect(contextRow?.contains(screen.getByRole('button', { name: 'Open issue #7' }))).toBe(true);
    expect(
      contextRow?.querySelector('[data-presentation="chip"]')?.getAttribute('aria-label'),
    ).toBe('Link an issue');
  });

  it('seats branch, diff and the PR surface on the project row', () => {
    mountApiProject();
    stats.current = new Map([['/worktrees/api', { additions: 2, deletions: 1 }]]);
    store.sessionGithub = {
      [SESSION_ID]: {
        pr: { number: 42, state: 'open', isDraft: false, checks: 'success', reviewDecision: null },
      },
    };
    const { container } = render(
      <HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />,
    );
    const projectRow = container.firstElementChild?.children[2];

    expect(projectRow?.contains(screen.getByRole('button', { name: 'api' }))).toBe(true);
    expect(
      projectRow?.contains(screen.getByRole('button', { name: 'Copy branch goodboy/x' })),
    ).toBe(true);
    expect(
      projectRow?.contains(screen.getByRole('button', { name: 'View the changes of api' })),
    ).toBe(true);
    expect(projectRow?.contains(screen.getByRole('button', { name: 'Open PR #42' }))).toBe(true);
  });

  it('puts the title first and only the folder and destructive controls at the far end of that row', () => {
    const { container } = render(
      <HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />,
    );
    const titleRow = container.firstElementChild?.firstElementChild;

    expect(titleRow?.textContent).toContain('refactor auth');
    expect(titleRow?.querySelector('[aria-label="open worktree"]')).not.toBeNull();
    expect(titleRow?.querySelector('[aria-label="branch actions"]')).toBeNull();
    expect(titleRow?.querySelector('[aria-label="session actions"]')).not.toBeNull();
  });

  it('moves the git actions off the title cluster onto the project row', () => {
    mountApiProject();
    const { container } = render(
      <HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />,
    );
    const titleRow = container.firstElementChild?.firstElementChild;
    const projectRow = container.firstElementChild?.children[2];

    expect(titleRow?.querySelector('[aria-label="branch actions"]')).toBeNull();
    expect(projectRow?.querySelector('[aria-label="branch actions"]')).not.toBeNull();
    expect(projectRow?.querySelector('[aria-label="Sync with main"]')).not.toBeNull();
    expect(sessionGitActionsCalls).toEqual([{ sessionId: SESSION_ID, density: 'compact' }]);
  });

  it('opens the sync popover on the project row and reports the distance from main', async () => {
    mountApiProject();
    worktreeMocks.worktreeStatus.mockResolvedValue({
      branch: 'goodboy/x',
      head: 'abc123',
      headSubject: null,
      upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
      mainDistance: { kind: 'known', ahead: 3, behind: 2 },
      workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
      upstream: null,
      inProgress: null,
    });
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sync with main' }));
    expect(worktreeMocks.worktreeStatus).toHaveBeenCalledWith('/worktrees/api');
    expect(await screen.findByText('3 commits ahead of main, 2 behind')).toBeDefined();
  });

  it('keeps the link affordance expanded with zero linked work and collapses it beside linked chips', () => {
    const zero = render(
      <HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />,
    );
    expect(
      zero.container.querySelector('[aria-label="Link an issue"]')?.getAttribute('data-collapsed'),
    ).toBe('false');
    cleanup();

    store.sessionExternalTasks = {
      [SESSION_ID]: [
        { provider: 'linear', identifier: 'GRW-111', title: 'Grow', externalId: 'grw-111' },
      ],
    };
    const linked = render(
      <HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />,
    );
    expect(
      linked.container
        .querySelector('[aria-label="Link an issue"]')
        ?.getAttribute('data-collapsed'),
    ).toBe('true');
  });

  it('renames from a click on the title, with no separate edit button', () => {
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    expect(screen.queryByRole('button', { name: /edit goal/i })).toBeNull();
    fireEvent.click(screen.getByText('refactor auth'));
    expect(screen.getByRole('textbox', { name: 'Session title' })).toBeDefined();
  });

  it('opens rename with the whole title selected when creation flags this session', () => {
    store.pendingTitleFocusSessionId = SESSION_ID;
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    const input = screen.getByRole('textbox', { name: 'Session title' }) as HTMLInputElement;
    expect(store.clearPendingTitleFocus).toHaveBeenCalledOnce();
    expect(input.value).toBe('refactor auth');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('refactor auth'.length);
  });

  it('leaves the title alone when the pending focus names another session', () => {
    store.pendingTitleFocusSessionId = 'sess-other';
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    expect(screen.queryByRole('textbox', { name: 'Session title' })).toBeNull();
    expect(store.clearPendingTitleFocus).not.toHaveBeenCalled();
  });

  it('reaches rename from the keyboard as well as the mouse', () => {
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);
    const title = screen.getByText('refactor auth');

    expect(title.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(title, { key: 'Enter' });
    expect(screen.getByRole('textbox', { name: 'Session title' })).toBeDefined();
  });

  it('leaves "Mark all seen" to the activity heading', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [{ id: 'agent-1' }] };
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    expect(screen.queryByRole('button', { name: /mark all seen/i })).toBeNull();
  });

  it('keeps the scope entry out of a workspace with no projects', () => {
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    expect(screen.queryByText('No project mounted')).toBeNull();
  });

  it('orders the chips as context, then project, branch, diff', () => {
    mountApiProject();
    stats.current = new Map([['/worktrees/api', { additions: 2, deletions: 1 }]]);
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    const follows = (first: Element, second: Element) =>
      (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const context = screen.getByRole('button', { name: 'Context' });
    const project = screen.getByRole('button', { name: 'api' });
    const branch = screen.getByRole('button', { name: 'Copy branch goodboy/x' });
    const diff = screen.getByRole('button', { name: 'View the changes of api' });
    expect(follows(context, project)).toBe(true);
    expect(follows(project, branch)).toBe(true);
    expect(follows(branch, diff)).toBe(true);
  });

  it('shows the plain project name when only one project is mounted', () => {
    store.projects = [{ id: 'project-1', workspaceId: 'ws-1', kind: 'repo', name: 'api' }];
    store.sessionProjectMounts = {
      [SESSION_ID]: [
        {
          projectId: 'project-1',
          mountName: 'api',
          branch: 'goodboy/x',
          worktreePath: '/worktrees/api',
        },
      ],
    };
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    expect(screen.getByRole('button', { name: 'api' })).toBeDefined();
    expect(screen.queryByText('+1')).toBeNull();
  });

  it('counts the extra mounts on the project chip label', () => {
    store.projects = [
      { id: 'project-1', workspaceId: 'ws-1', kind: 'repo', name: 'api' },
      { id: 'project-2', workspaceId: 'ws-1', kind: 'repo', name: 'web' },
    ];
    store.sessionProjectMounts = {
      [SESSION_ID]: [
        {
          projectId: 'project-1',
          mountName: 'api',
          branch: 'goodboy/x',
          worktreePath: '/worktrees/api',
        },
        {
          projectId: 'project-2',
          mountName: 'web',
          branch: 'goodboy/y',
          worktreePath: '/worktrees/web',
        },
      ],
    };
    store.sessionActiveProject = { [SESSION_ID]: 'project-1' };
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    expect(screen.getByRole('button', { name: 'api +1' })).toBeDefined();
  });

  it('omits the branch chip on a branchless mount', () => {
    store.projects = [{ id: 'project-1', workspaceId: 'ws-1', kind: 'repo', name: 'api' }];
    store.sessionProjectMounts = {
      [SESSION_ID]: [
        { projectId: 'project-1', mountName: 'api', branch: '', worktreePath: '/worktrees/api' },
      ],
    };
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    expect(screen.getByRole('button', { name: 'api' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Copy branch/ })).toBeNull();
  });

  it('opens the diff of the primary mount from the changes chip', () => {
    store.projects = [
      { id: 'project-1', workspaceId: 'ws-1', kind: 'repo', name: 'api' },
      { id: 'project-2', workspaceId: 'ws-1', kind: 'repo', name: 'web' },
    ];
    store.sessionProjectMounts = {
      [SESSION_ID]: [
        {
          projectId: 'project-1',
          mountName: 'api',
          branch: 'goodboy/x',
          worktreePath: '/worktrees/api',
        },
        {
          projectId: 'project-2',
          mountName: 'web',
          branch: 'goodboy/y',
          worktreePath: '/worktrees/web',
        },
      ],
    };
    store.sessionActiveProject = { [SESSION_ID]: 'project-2' };
    stats.current = new Map([
      ['/worktrees/api', { additions: 12, deletions: 3 }],
      ['/worktrees/web', { additions: 4, deletions: 1 }],
    ]);
    const onSelectLens = vi.fn();
    render(<HeaderBand session={baseSession()} onSelectLens={onSelectLens} goal={GOAL_STUB} />);

    fireEvent.click(screen.getByRole('button', { name: 'View the changes of web' }));
    expect(store.openMountDiff).toHaveBeenCalledWith(SESSION_ID, '/worktrees/web');
    expect(onSelectLens).not.toHaveBeenCalled();
  });

  it('reaches the projects page from the popover footer when nothing is mounted', () => {
    store.projects = [{ id: 'project-1', workspaceId: 'ws-1', kind: 'repo', name: 'api' }];
    store.sessionProjectMounts = { [SESSION_ID]: [] };
    const onSelectLens = vi.fn();
    render(<HeaderBand session={baseSession()} onSelectLens={onSelectLens} goal={GOAL_STUB} />);

    fireEvent.click(screen.getByRole('button', { name: 'No project mounted' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open projects page' }));
    expect(onSelectLens).toHaveBeenCalledWith('projects');
    expect(store.openMountDiff).not.toHaveBeenCalled();
  });

  it('copies the active branch from the chip without leaving the overview', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    store.projects = [{ id: 'project-1', workspaceId: 'ws-1', kind: 'repo', name: 'api' }];
    store.sessionProjectMounts = {
      [SESSION_ID]: [
        {
          projectId: 'project-1',
          mountName: 'api',
          branch: 'goodboy/x',
          worktreePath: '/worktrees/api',
        },
      ],
    };
    const onSelectLens = vi.fn();
    render(<HeaderBand session={baseSession()} onSelectLens={onSelectLens} goal={GOAL_STUB} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy branch goodboy/x' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('goodboy/x'));
    expect(onSelectLens).not.toHaveBeenCalled();
  });

  it('opens the branch switch panel from the pencil beside the branch', () => {
    store.projects = [{ id: 'project-1', workspaceId: 'ws-1', kind: 'repo', name: 'api' }];
    store.sessionProjectMounts = {
      [SESSION_ID]: [
        {
          projectId: 'project-1',
          mountName: 'api',
          branch: 'goodboy/x',
          worktreePath: '/worktrees/api',
        },
      ],
    };
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch branch' }));
    expect(screen.getByTestId('branch-switch-panel')).toBeDefined();
  });

  it('offers a context shortcut in the vitals row that opens the context lens', () => {
    const onSelectLens = vi.fn();
    render(<HeaderBand session={baseSession()} onSelectLens={onSelectLens} goal={GOAL_STUB} />);

    const chip = screen.getByRole('button', { name: 'Context' });
    expect(chip.closest('[data-tooltip]')?.getAttribute('data-tooltip')).toBe(
      'Decisions and session summary, kept fresh by the summarizer',
    );
    fireEvent.click(chip);
    expect(onSelectLens).toHaveBeenCalledWith('context');
  });

  it('folds the summarizer spend into the context chip as muted trailing text', () => {
    store.sessionTelemetry = {
      [SESSION_ID]: [
        { kind: 'summarizer', estimatedCostUsd: 0.03 },
        { kind: 'summarizer', estimatedCostUsd: 0.012 },
        { kind: 'agent', estimatedCostUsd: 5 },
      ],
    };
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    const chip = screen.getByRole('button', { name: /Context/ });
    expect(chip.textContent).toContain('Σ $0.042');
    expect(chip.closest('[data-tooltip]')?.getAttribute('data-tooltip')).toBe(
      'Decisions and session summary, kept fresh by the summarizer, spent Σ $0.042',
    );
  });

  it('seats the summarizer working-state inside the context chip cluster', () => {
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    const badge = screen.getByTestId('summarizer-badge');
    const cluster = badge.parentElement;
    expect(cluster?.contains(screen.getByRole('button', { name: 'Context' }))).toBe(true);
  });

  it('traces a spinning border around the context chip while the summarizer works', () => {
    summarizer.current = { status: 'running', error: null, lastAttempt: null };
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    const chip = screen.getByRole('button', { name: 'Context' });
    expect(chip.className).toContain('spin-border');
    expect(chip.className).toContain('spin-border-primary');
    expect(screen.queryByTestId('summarizer-badge')).toBeNull();
  });

  it('keeps the context chip border still while the summarizer is idle', () => {
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    expect(screen.getByRole('button', { name: 'Context' }).className).not.toContain('spin-border');
  });

  it('wraps both chip rows instead of dropping chips when a PR and linked tasks pile up', () => {
    mountApiProject();
    store.sessionGithub = {
      [SESSION_ID]: {
        pr: { number: 42, state: 'open', isDraft: false, checks: 'success', reviewDecision: null },
        linkedIssues: [
          { number: 7, title: 'Broken auth', url: 'https://github.com/acme/repo/issues/7' },
        ],
      },
    };
    store.sessionExternalTasks = {
      [SESSION_ID]: [
        { provider: 'linear', identifier: 'LIN-42', title: 'Fix auth', externalId: 'lin-42' },
        { provider: 'jira', identifier: 'JIRA-9', title: 'Audit tokens', externalId: 'jira-9' },
      ],
    };
    const { container } = render(
      <HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />,
    );

    expect(screen.getByRole('button', { name: 'Open PR #42' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open issue #7' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open LIN-42' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open JIRA-9' })).toBeDefined();

    const contextRow = container.firstElementChild?.children[1];
    const projectRow = container.firstElementChild?.children[2];
    expect(contextRow?.className).toContain('flex-wrap');
    expect(projectRow?.className).toContain('flex-wrap');
  });

  it('keeps the link-issue action out of the title cluster, living only on the context row', () => {
    const { container } = render(
      <HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />,
    );
    const titleRow = container.firstElementChild?.firstElementChild;
    const cluster = titleRow?.lastElementChild;

    expect(cluster?.querySelector('[aria-label="Link an issue"]')).toBeNull();
    expect(container.querySelectorAll('[aria-label="Link an issue"]')).toHaveLength(1);
    expect(
      container.querySelector('[aria-label="Link an issue"]')?.getAttribute('data-presentation'),
    ).toBe('chip');
  });

  it('renders no PR surface when the mount has no reachable remote', () => {
    mountApiProject();
    hooks.remoteKind.current = 'none';
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);

    expect(screen.queryByRole('button', { name: /open pull request/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /open merge request/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'api' })).toBeDefined();
  });

  it('mounts the editor menu and destructive actions on the title row, leaving git actions to the project row', () => {
    render(<HeaderBand session={baseSession()} onSelectLens={vi.fn()} goal={GOAL_STUB} />);
    expect(editorMenuCalls).toEqual([{ sessionId: SESSION_ID, density: 'compact' }]);
    expect(sessionGitActionsCalls).toEqual([]);
    expect(sessionDestructiveActionsCalls).toEqual([{ sessionId: SESSION_ID }]);
  });
});
