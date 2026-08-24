// @vitest-environment happy-dom

import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session, SessionId, SessionStageInfo } from '@goodboy/types';

type Store = {
  sessions: ReadonlyArray<Session>;
  workspaces: ReadonlyArray<unknown>;
  projects: ReadonlyArray<{ id: string; workspaceId: string; kind?: string }>;
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
  sessionPhaseRuns: Record<string, ReadonlyArray<unknown>>;
  pendingTitleFocusSessionId: string | null;
  markAllAgentsSeen: ReturnType<typeof vi.fn>;
  renameTask: ReturnType<typeof vi.fn>;
  setFocusedGithubIssueNumber: ReturnType<typeof vi.fn>;
  openExternalTaskLens: ReturnType<typeof vi.fn>;
  openMountDiff: ReturnType<typeof vi.fn>;
  clearPendingTitleFocus: ReturnType<typeof vi.fn>;
};

const { store, hooks } = vi.hoisted(() => ({
  store: {
    sessions: [] as ReadonlyArray<Session>,
    workspaces: [] as ReadonlyArray<unknown>,
    projects: [] as ReadonlyArray<{ id: string; workspaceId: string; kind?: string }>,
    sessionBranches: {} as Record<string, string>,
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    sessionProjectMounts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionActiveProject: {} as Record<string, string>,
    sessionGithub: {} as Store['sessionGithub'],
    sessionGitlabMr: {} as Record<string, { mr?: unknown }>,
    sessionExternalTasks: {} as Record<string, ReadonlyArray<unknown>>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    pendingTitleFocusSessionId: null as string | null,
    markAllAgentsSeen: vi.fn(async () => undefined),
    renameTask: vi.fn(async () => undefined),
    setFocusedGithubIssueNumber: vi.fn(),
    openExternalTaskLens: vi.fn(),
    openMountDiff: vi.fn(),
    clearPendingTitleFocus: vi.fn(),
  } as Store,
  hooks: {
    remoteKind: { current: 'github' as 'github' | 'gitlab' | 'other' | 'none' | null },
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  agentHasUnread: () => false,
  useAppStore: <T,>(selector: (s: Store) => T) => selector(store),
  useCurrentWorkspace: () => null,
  useMountDiffStats: () => new Map(),
}));

vi.mock('../SummarizerBadge', () => ({
  SummarizerBadge: () => <span data-testid="summarizer-badge" />,
}));

vi.mock('../../../../app/components/Toast', () => {
  const showToast = vi.fn();
  return { useToast: () => ({ showToast }) };
});

vi.mock('./SessionCostChip', () => ({
  SessionCostChip: () => <span data-testid="cost-chip" />,
}));

vi.mock('../../../worktree/useRemoteHostKind', () => ({
  useRemoteHostKind: () => hooks.remoteKind.current,
}));

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
  LinkIssueAction: () => <button type="button" aria-label="Link an issue" />,
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

const baseSession = (): Session =>
  ({
    id: SESSION_ID,
    workspaceId: 'ws-1',
    goal: 'refactor auth',
    state: { kind: 'idle' },
    createdAt: '2026-06-22T10:00:00.000Z',
    workflowRuns: [],
  }) as unknown as Session;

const stageWith = (over: Partial<SessionStageInfo> = {}): SessionStageInfo =>
  ({ stage: 'attention', reason: 'PR needs review', ...over }) as SessionStageInfo;

beforeEach(() => {
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
  store.sessionPhaseRuns = {};
  store.pendingTitleFocusSessionId = null;
  store.markAllAgentsSeen.mockReset();
  store.renameTask.mockReset();
  store.setFocusedGithubIssueNumber.mockReset();
  store.openExternalTaskLens.mockReset();
  store.openMountDiff.mockReset();
  store.clearPendingTitleFocus.mockReset();
  hooks.remoteKind.current = 'github';
  editorMenuCalls.length = 0;
  sessionGitActionsCalls.length = 0;
  sessionDestructiveActionsCalls.length = 0;
});
afterEach(cleanup);

describe('HeaderBand', () => {
  it('states the stage label and the reason together, not the reason alone', () => {
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={vi.fn()} />);
    const tooltip = screen.getByText('PR needs review').closest('[data-tooltip]');
    expect(tooltip?.getAttribute('data-tooltip')).toBe('needs you · PR needs review');
  });

  it('hides the noisy "no PR yet" reason to make room for the create action', () => {
    render(
      <HeaderBand
        session={baseSession()}
        stage={stageWith({ stage: 'building', reason: 'no PR yet' })}
        onSelectLens={vi.fn()}
      />,
    );
    expect(screen.queryByText('no PR yet')).toBeNull();
    expect(screen.getByRole('button', { name: /open pull request/i })).toBeDefined();
  });

  it('offers a merge-request creation action when the remote is GitLab', () => {
    hooks.remoteKind.current = 'gitlab';
    render(
      <HeaderBand
        session={baseSession()}
        stage={stageWith({ stage: 'building', reason: '' })}
        onSelectLens={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /open merge request/i })).toBeDefined();
  });

  it('dispatches the GitHub studio event when the create action fires', () => {
    const events: Array<CustomEvent> = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    window.addEventListener('goodboy:open-github-session', listener);
    render(
      <HeaderBand
        session={baseSession()}
        stage={stageWith({ stage: 'building', reason: '' })}
        onSelectLens={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /open pull request/i }));
    window.removeEventListener('goodboy:open-github-session', listener);
    expect(events[0]?.detail).toEqual({ sessionId: SESSION_ID });
  });

  it('inlines the pull request chip in the status row when a PR exists', () => {
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
    render(
      <HeaderBand
        session={baseSession()}
        stage={stageWith({ stage: 'review', reason: 'PR #42 awaiting review' })}
        onSelectLens={vi.fn()}
      />,
    );
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
    render(
      <HeaderBand
        session={baseSession()}
        stage={stageWith({ stage: 'building', reason: '' })}
        onSelectLens={onSelectLens}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open issue #7' }));
    expect(store.setFocusedGithubIssueNumber).toHaveBeenCalledWith(SESSION_ID, 7);
    expect(onSelectLens).toHaveBeenCalledWith('github_issue');
  });

  it('fits the header into exactly two rows', () => {
    const { container } = render(
      <HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={vi.fn()} />,
    );
    const band = container.firstElementChild;

    expect(band?.children).toHaveLength(2);
  });

  it('puts the title first and the folder, branch and destructive controls at the far end of that row', () => {
    const { container } = render(
      <HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={vi.fn()} />,
    );
    const titleRow = container.firstElementChild?.firstElementChild;

    expect(titleRow?.textContent).toContain('refactor auth');
    expect(titleRow?.querySelector('[aria-label="open worktree"]')).not.toBeNull();
    expect(titleRow?.querySelector('[aria-label="branch actions"]')).not.toBeNull();
    expect(titleRow?.querySelector('[aria-label="session actions"]')).not.toBeNull();
  });

  it('renames from a click on the title, with no separate edit button', () => {
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /edit goal/i })).toBeNull();
    fireEvent.click(screen.getByText('refactor auth'));
    expect(screen.getByRole('textbox', { name: 'Session title' })).toBeDefined();
  });

  it('opens rename with the whole title selected when creation flags this session', () => {
    store.pendingTitleFocusSessionId = SESSION_ID;
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: 'Session title' }) as HTMLInputElement;
    expect(store.clearPendingTitleFocus).toHaveBeenCalledOnce();
    expect(input.value).toBe('refactor auth');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('refactor auth'.length);
  });

  it('leaves the title alone when the pending focus names another session', () => {
    store.pendingTitleFocusSessionId = 'sess-other';
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={vi.fn()} />);

    expect(screen.queryByRole('textbox', { name: 'Session title' })).toBeNull();
    expect(store.clearPendingTitleFocus).not.toHaveBeenCalled();
  });

  it('reaches rename from the keyboard as well as the mouse', () => {
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={vi.fn()} />);
    const title = screen.getByText('refactor auth');

    expect(title.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(title, { key: 'Enter' });
    expect(screen.getByRole('textbox', { name: 'Session title' })).toBeDefined();
  });

  it('leaves "Mark all seen" to the activity heading', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [{ id: 'agent-1' }] };
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /mark all seen/i })).toBeNull();
  });

  it('keeps the scope entry out of a workspace with no projects', () => {
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /No projects mounted/ })).toBeNull();
  });

  it('shows no scope entry until the session mount is known', () => {
    store.projects = [{ id: 'project-1', workspaceId: 'ws-1', kind: 'repo' }];
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /No projects mounted/ })).toBeNull();
  });

  it('shows the active mount with its branch and opens the diff of that mount', () => {
    store.projects = [{ id: 'project-1', workspaceId: 'ws-1', kind: 'repo' }];
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
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={onSelectLens} />);

    fireEvent.click(screen.getByRole('button', { name: 'api goodboy/x' }));
    expect(store.openMountDiff).toHaveBeenCalledWith(SESSION_ID, '/worktrees/api');
    expect(onSelectLens).not.toHaveBeenCalled();
  });

  it('omits the branch part and the copy affordance on a branchless mount', () => {
    store.projects = [{ id: 'project-1', workspaceId: 'ws-1', kind: 'repo' }];
    store.sessionProjectMounts = {
      [SESSION_ID]: [{ projectId: 'project-1', mountName: 'api', branch: '' }],
    };
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'api' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Copy branch/ })).toBeNull();
  });

  it('keeps the project list one click away behind the overflow count', () => {
    store.projects = [
      { id: 'project-1', workspaceId: 'ws-1', kind: 'repo' },
      { id: 'project-2', workspaceId: 'ws-1', kind: 'repo' },
      { id: 'project-3', workspaceId: 'ws-1', kind: 'repo' },
    ];
    store.sessionProjectMounts = {
      [SESSION_ID]: [
        { projectId: 'project-1', mountName: 'api', branch: 'goodboy/x' },
        {
          projectId: 'project-2',
          mountName: 'web',
          branch: 'goodboy/y',
          worktreePath: '/worktrees/web',
        },
        { projectId: 'project-3', mountName: 'docs', branch: 'goodboy/z' },
      ],
    };
    store.sessionActiveProject = { [SESSION_ID]: 'project-2' };
    const onSelectLens = vi.fn();
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={onSelectLens} />);

    fireEvent.click(screen.getByRole('button', { name: 'web goodboy/y' }));
    expect(store.openMountDiff).toHaveBeenCalledWith(SESSION_ID, '/worktrees/web');
    expect(onSelectLens).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open the projects page, 2 more mounted' }));
    expect(onSelectLens).toHaveBeenCalledWith('projects');
    expect(screen.queryByText('goodboy/x')).toBeNull();
  });

  it('keeps the projects page reachable when only one project is mounted', () => {
    store.projects = [{ id: 'project-1', workspaceId: 'ws-1', kind: 'repo' }];
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
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={onSelectLens} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open the projects page' }));
    expect(onSelectLens).toHaveBeenCalledWith('projects');
  });

  it('offers the projects page instead of vanishing when nothing is mounted', () => {
    store.projects = [{ id: 'project-1', workspaceId: 'ws-1', kind: 'repo' }];
    store.sessionProjectMounts = { [SESSION_ID]: [] };
    const onSelectLens = vi.fn();
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={onSelectLens} />);

    fireEvent.click(screen.getByRole('button', { name: /no project mounted/i }));
    expect(onSelectLens).toHaveBeenCalledWith('projects');
    expect(store.openMountDiff).not.toHaveBeenCalled();
  });

  it('copies the active branch from the chip without leaving the overview', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    store.projects = [{ id: 'project-1', workspaceId: 'ws-1', kind: 'repo' }];
    store.sessionProjectMounts = {
      [SESSION_ID]: [{ projectId: 'project-1', mountName: 'api', branch: 'goodboy/x' }],
    };
    const onSelectLens = vi.fn();
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={onSelectLens} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy branch goodboy/x' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('goodboy/x'));
    expect(onSelectLens).not.toHaveBeenCalled();
  });

  it('offers a context shortcut in the vitals row that opens the context lens', () => {
    const onSelectLens = vi.fn();
    render(<HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={onSelectLens} />);

    const chip = screen.getByRole('button', { name: 'Context' });
    expect(chip.closest('[data-tooltip]')?.getAttribute('data-tooltip')).toBe(
      'Decisions and session summary',
    );
    fireEvent.click(chip);
    expect(onSelectLens).toHaveBeenCalledWith('context');
  });

  it('seats the link-issue action in the icon cluster of the title row', () => {
    const { container } = render(
      <HeaderBand session={baseSession()} stage={stageWith()} onSelectLens={vi.fn()} />,
    );
    const titleRow = container.firstElementChild?.firstElementChild;
    const cluster = titleRow?.lastElementChild;

    expect(cluster?.querySelector('[aria-label="Link an issue"]')).not.toBeNull();
    expect(cluster?.firstElementChild?.getAttribute('aria-label')).toBe('Link an issue');
  });

  it('mounts the editor menu, git actions and destructive actions at compact density for this session', () => {
    render(
      <HeaderBand
        session={baseSession()}
        stage={stageWith({ stage: 'building', reason: '' })}
        onSelectLens={vi.fn()}
      />,
    );
    expect(editorMenuCalls).toEqual([{ sessionId: SESSION_ID, density: 'compact' }]);
    expect(sessionGitActionsCalls).toEqual([{ sessionId: SESSION_ID, density: 'compact' }]);
    expect(sessionDestructiveActionsCalls).toEqual([{ sessionId: SESSION_ID }]);
  });
});
