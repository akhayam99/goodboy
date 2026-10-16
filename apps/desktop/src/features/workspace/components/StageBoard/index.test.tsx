// @vitest-environment happy-dom

import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Project,
  ProjectId,
  Session,
  SessionId,
  Workspace,
  WorkspaceGitStatus,
  WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';

const { state, gitStatuses, groups } = vi.hoisted(() => ({
  state: {
    boardReady: true,
    archivedSessions: {} as Record<string, ReadonlyArray<Session>>,
    loadArchivedSessions: vi.fn(),
    workspaces: [] as ReadonlyArray<Workspace>,
    projects: [] as ReadonlyArray<Project>,
    bulkUnarchiveTask: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
  },
  gitStatuses: { current: {} as Record<string, WorkspaceGitStatus | null> },
  groups: { current: [] as ReadonlyArray<{ key: string; sessions: ReadonlyArray<Session> }> },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: (selector: (s: typeof state) => unknown) => selector(state),
  useStageGroupedSessions: () => groups.current,
  useProjectFilteredSessions: ({ sessions }: { sessions: ReadonlyArray<Session> }) => sessions,
  useSessionListModel: () => ({ groups: [], stageBySession: {}, hiddenByFilters: 0 }),
  useSessionViewPrefs: () => ({
    pageView: 'board',
    sort: 'needsYou',
    group: 'none',
    isArchivedShown: false,
    isFoldOpen: false,
    statusFilter: [],
  }),
}));

vi.mock('../../../session/hooks/useSessionArchive', () => ({
  useSessionArchive: () => ({
    archive: vi.fn(async () => undefined),
    restore: vi.fn(async () => undefined),
  }),
}));

vi.mock('../../hooks/useProjectGitStatuses', () => ({
  useProjectGitStatuses: () =>
    state.projects
      .filter((project) => project.kind === 'repo')
      .map((project) => ({ project, status: gitStatuses.current[project.id] ?? null })),
}));

vi.mock('../../../onboarding/OnboardingWizard/steps/ProjectsStep', () => ({
  ProjectsStep: ({ workspace }: { workspace: Workspace }) => (
    <div data-testid="projects-step">{workspace.name}</div>
  ),
}));

vi.mock('../ProjectGitPill/RepoStatusSection', () => ({
  RepoStatusSection: ({
    entries,
  }: {
    entries: ReadonlyArray<{ project: Project; status: WorkspaceGitStatus | null }>;
  }) => <span data-testid="repo-pill">{entries.map(({ project }) => project.name).join(',')}</span>,
}));

vi.mock('../SessionActivityBar/SessionFilterPopover', () => ({
  SessionFilterPopover: ({
    footer,
    hasAttention,
  }: {
    footer?: ReactNode;
    hasAttention?: boolean;
  }) => (
    <span data-testid="session-filter" data-attention={String(hasAttention === true)}>
      {footer}
    </span>
  ),
}));

vi.mock('./useBoardNavigation', () => ({
  useBoardNavigation: () => ({ restore: vi.fn() }),
}));

vi.mock('./StageColumn', () => ({
  StageColumn: ({
    spec,
    sessions,
    selection,
  }: {
    spec: { kind: string; stage?: string };
    sessions: ReadonlyArray<Session>;
    selection: {
      onItemClick: (id: SessionId, event: ModifierEvent) => void;
    };
  }) => (
    <div
      data-testid="stage-column"
      id={`board-column-${spec.kind === 'stage' ? spec.stage : 'archived'}`}
    >
      {spec.kind === 'stage' ? spec.stage : 'archived'}
      {sessions.map((entry) => (
        <button
          key={entry.id}
          type="button"
          data-select-id={entry.id}
          aria-label={`card ${entry.id}`}
          onClick={(event) => selection.onItemClick(entry.id as SessionId, event)}
        />
      ))}
    </div>
  ),
}));

vi.mock('../../../actions/useActionControls', () => ({
  useActionControls: () => ({
    target: null,
    actions: [],
    inSlot: () => [],
    pendingId: null,
    confirming: null,
    failure: null,
    trigger: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
    retry: vi.fn(),
  }),
}));

vi.mock('../../../../shared/components/ObjectSelectionBar', () => ({
  ObjectSelectionBar: ({ count }: { readonly count: number }) =>
    count === 0 ? null : <div role="toolbar">{count} selected</div>,
}));

vi.mock('../../../session/components/DeleteSessionConfirm', () => ({
  DeleteSessionConfirm: () => null,
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    Tooltip: ({ content, children }: { content: string; children: ReactElement }) => (
      <span data-tooltip={content}>{children}</span>
    ),
  };
});

import { StageBoard } from './index';

type ModifierEvent = {
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
};

const session = aSession({ id: 's-1' as SessionId });
const wsId = 'ws-a' as WorkspaceId;

const workspace = aWorkspace({ id: wsId, name: 'fresh-idea', slug: 'fresh-idea' });

const boxOf = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  }) as DOMRect;

const statusOf = (state: WorkspaceGitStatus['state']): WorkspaceGitStatus => ({
  state,
  branch: null,
  headSubject: null,
  upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: null,
  inProgress: null,
});

const projectOf = ({
  id,
  kind = 'repo',
  name = id,
}: {
  readonly id: string;
  readonly kind?: Project['kind'];
  readonly name?: string;
}): Project =>
  aProject({ id: id as ProjectId, workspaceId: wsId, kind, name, rootPath: `/tmp/${id}` });

beforeEach(() => {
  localStorage.clear();
  state.boardReady = true;
  state.archivedSessions = { [wsId]: [] };
  state.loadArchivedSessions = vi.fn();
  state.workspaces = [workspace];
  state.projects = [projectOf({ id: 'proj-1', name: 'fresh-idea' })];
  gitStatuses.current = { 'proj-1': statusOf('ready') };
  groups.current = [];
});
afterEach(cleanup);

describe('StageBoard loading gate', () => {
  it('shows the skeleton board while boardReady is false, hiding columns and empty state', () => {
    state.boardReady = false;
    render(<StageBoard workspaceId={wsId} sessions={[session]} />);
    expect(screen.getByLabelText('Loading board')).toBeDefined();
    expect(screen.queryByTestId('stage-column')).toBeNull();
    expect(screen.queryByText('No sessions yet')).toBeNull();
  });

  it('renders the empty state once ready with no sessions', () => {
    render(<StageBoard workspaceId={wsId} sessions={[]} />);
    expect(screen.queryByLabelText('Loading board')).toBeNull();
    expect(screen.getByText('No sessions yet')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Sessions' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'New session' })).toHaveLength(1);
  });

  it('renders stage columns once ready with sessions', () => {
    render(<StageBoard workspaceId={wsId} sessions={[session]} />);
    expect(screen.queryByLabelText('Loading board')).toBeNull();
    expect(screen.getAllByTestId('stage-column').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 1, name: 'Sessions' })).toBeDefined();
    expect(screen.getByTestId('session-filter')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'New session' })).toBeNull();
  });

  it('leaves the total out of the title and has no Ongoing row on the board', () => {
    render(<StageBoard workspaceId={wsId} sessions={[session]} />);
    expect(screen.queryByText(/^\d+ sessions?$/)).toBeNull();
    expect(screen.queryByRole('group', { name: 'Ongoing' })).toBeNull();
    expect(screen.queryByText('Ongoing')).toBeNull();
    expect(screen.queryByRole('button', { name: /Stop tracking/ })).toBeNull();
  });

  it('renders the board with the archived column instead of the hero when only archived sessions exist', () => {
    const shelved = aSession({ id: 's-9' as SessionId });
    state.archivedSessions = { [wsId]: [shelved] };
    render(<StageBoard workspaceId={wsId} sessions={[]} />);
    expect(screen.queryByText('No sessions yet')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Sessions' })).toBeDefined();
    const columns = screen.getAllByTestId('stage-column');
    expect(columns.some((column) => column.textContent?.includes('archived'))).toBe(true);
    expect(screen.getByRole('button', { name: 'card s-9' })).toBeDefined();
  });

  it('holds the skeleton instead of the hero while the archived list is still unknown', () => {
    state.archivedSessions = {};
    render(<StageBoard workspaceId={wsId} sessions={[]} />);
    expect(screen.getByLabelText('Loading board')).toBeDefined();
    expect(screen.queryByText('No sessions yet')).toBeNull();
  });
});

describe('StageBoard empty-projects gate', () => {
  it('leads with the add-projects surface instead of session creation when no project exists', () => {
    state.projects = [];
    render(<StageBoard workspaceId={wsId} sessions={[]} />);
    expect(screen.getByTestId('projects-step').textContent).toBe('fresh-idea');
    expect(screen.queryByText('No sessions yet')).toBeNull();
    expect(screen.queryByRole('button', { name: 'New session' })).toBeNull();
  });

  it('leaves the projects step out and keeps the board while sessions exist but no project does', () => {
    state.projects = [];
    groups.current = [{ key: 'building', sessions: [session] }];
    render(<StageBoard workspaceId={wsId} sessions={[session]} />);
    expect(screen.queryByTestId('projects-step')).toBeNull();
    expect(screen.getAllByTestId('stage-column').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'New session' })).toBeNull();
  });

  it('flips back to the session-first empty state once a project lands', () => {
    state.projects = [];
    const { rerender } = render(<StageBoard workspaceId={wsId} sessions={[]} />);
    expect(screen.getByTestId('projects-step')).toBeDefined();

    state.projects = [projectOf({ id: 'proj-1' })];
    gitStatuses.current = { 'proj-1': statusOf('ready') };
    rerender(<StageBoard workspaceId={wsId} sessions={[]} />);
    expect(screen.queryByTestId('projects-step')).toBeNull();
    expect(screen.getByText('No sessions yet')).toBeDefined();
  });
});

describe('StageBoard git gate', () => {
  it('enables New session on the empty board when one repo is ready even if another repo is broken', () => {
    state.projects = [projectOf({ id: 'proj-1' }), projectOf({ id: 'proj-2' })];
    gitStatuses.current = { 'proj-1': statusOf('ready'), 'proj-2': statusOf('missing') };
    render(<StageBoard workspaceId={wsId} sessions={[]} />);
    expect(screen.getByRole('button', { name: 'New session' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('enables New session on the empty board when a folder project is available', () => {
    state.projects = [projectOf({ id: 'folder-a', kind: 'folder' })];
    render(<StageBoard workspaceId={wsId} sessions={[]} />);
    expect(screen.getByRole('button', { name: 'New session' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('hands every repo project and no folder project to the filter footer, and dots the filter', () => {
    state.projects = [
      projectOf({ id: 'repo-a', name: 'Alpha' }),
      projectOf({ id: 'folder-a', kind: 'folder', name: 'Notes' }),
      projectOf({ id: 'repo-b', name: 'Beta' }),
    ];
    gitStatuses.current = {
      'repo-a': statusOf('ready'),
      'repo-b': statusOf('absent'),
    };
    render(<StageBoard workspaceId={wsId} sessions={[]} />);
    expect(screen.getAllByTestId('repo-pill')).toHaveLength(1);
    expect(screen.getByTestId('repo-pill').textContent).toBe('Alpha,Beta');
    expect(screen.getByTestId('session-filter').getAttribute('data-attention')).toBe('true');
  });

  it('explains an empty board whose only project is not usable yet', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-settings', listener);
    gitStatuses.current = { 'proj-1': statusOf('absent') };
    render(<StageBoard workspaceId={wsId} sessions={[]} />);

    expect(
      screen.getByRole('heading', {
        name: 'This project needs a git repository with one commit first',
      }),
    ).toBeDefined();
    expect(screen.queryByText('No sessions yet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open workspace settings' }));

    expect(listener).toHaveBeenCalledOnce();
    const [event] = listener.mock.calls[0] ?? [];
    expect(event instanceof CustomEvent ? event.detail : null).toEqual({ scope: 'workspace' });
    window.removeEventListener('goodboy:open-settings', listener);
  });

  it('names the unreachable folder on an empty board', () => {
    gitStatuses.current = { 'proj-1': statusOf('missing') };
    render(<StageBoard workspaceId={wsId} sessions={[]} />);

    expect(
      screen.getByRole('heading', { name: 'The project folder is unreachable' }),
    ).toBeDefined();
    expect(screen.getByText(/Relink it in workspace settings/)).toBeDefined();
  });
});

describe('StageBoard instant create', () => {
  it('dispatches the new-session event from the empty-board button', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:new-session', listener);
    render(<StageBoard workspaceId={wsId} sessions={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'New session' }));

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:new-session', listener);
  });
});

describe('StageBoard selection', () => {
  const other = aSession({ id: 's-2' as SessionId });
  const shelved = aSession({ id: 's-9' as SessionId });

  it('selects every card a lasso drag crosses, across columns', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    groups.current = [
      { key: 'building', sessions: [session] },
      { key: 'review', sessions: [other] },
    ];
    render(<StageBoard workspaceId={wsId} sessions={[session, other]} />);

    const cardA = screen.getByRole('button', { name: 'card s-1' });
    const cardB = screen.getByRole('button', { name: 'card s-2' });
    const columns = cardA.closest('[data-testid="stage-column"]')?.parentElement as HTMLElement;
    columns.getBoundingClientRect = () => boxOf(0, 0, 500, 500);
    cardA.getBoundingClientRect = () => boxOf(10, 10, 100, 40);
    cardB.getBoundingClientRect = () => boxOf(200, 10, 100, 40);

    fireEvent.pointerDown(columns, { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent(
      window,
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 400,
        clientY: 100,
        bubbles: true,
      }),
    );

    expect(screen.getByText('2 selected')).toBeDefined();

    fireEvent(window, new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
    expect(screen.getByText('2 selected')).toBeDefined();
  });

  it('leaves the cards a lasso drag misses untouched', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    groups.current = [{ key: 'building', sessions: [session, other] }];
    render(<StageBoard workspaceId={wsId} sessions={[session, other]} />);

    const cardA = screen.getByRole('button', { name: 'card s-1' });
    const columns = cardA.closest('[data-testid="stage-column"]')?.parentElement as HTMLElement;
    columns.getBoundingClientRect = () => boxOf(0, 0, 500, 500);
    cardA.getBoundingClientRect = () => boxOf(10, 300, 100, 40);
    screen.getByRole('button', { name: 'card s-2' }).getBoundingClientRect = () =>
      boxOf(10, 400, 100, 40);

    fireEvent.pointerDown(columns, { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent(
      window,
      new PointerEvent('pointermove', { pointerId: 1, clientX: 400, clientY: 100, bubbles: true }),
    );

    expect(screen.queryByText(/selected/)).toBeNull();
  });

  it('holds an active card and an archived card in one selection', () => {
    groups.current = [{ key: 'building', sessions: [session] }];
    state.archivedSessions = { [wsId]: [shelved] };
    render(<StageBoard workspaceId={wsId} sessions={[session]} />);

    fireEvent.click(screen.getByRole('button', { name: 'card s-1' }), { altKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'card s-9' }), { altKey: true });

    expect(screen.getByText('2 selected')).toBeDefined();
  });

  it('takes the archived hit too when a lasso spans into the archived lane', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    groups.current = [
      { key: 'building', sessions: [session] },
      { key: 'review', sessions: [other] },
    ];
    state.archivedSessions = { [wsId]: [shelved] };
    render(<StageBoard workspaceId={wsId} sessions={[session, other]} />);

    const cardA = screen.getByRole('button', { name: 'card s-1' });
    const cardB = screen.getByRole('button', { name: 'card s-2' });
    const cardShelved = screen.getByRole('button', { name: 'card s-9' });
    const columns = cardA.closest('[data-testid="stage-column"]')?.parentElement as HTMLElement;
    columns.getBoundingClientRect = () => boxOf(0, 0, 500, 500);
    cardA.getBoundingClientRect = () => boxOf(10, 10, 100, 40);
    cardB.getBoundingClientRect = () => boxOf(200, 10, 100, 40);
    cardShelved.getBoundingClientRect = () => boxOf(390, 10, 20, 40);

    fireEvent.pointerDown(columns, { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent(
      window,
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 400,
        clientY: 100,
        bubbles: true,
      }),
    );

    expect(screen.getByText('3 selected')).toBeDefined();
  });
});

describe('StageBoard lanes', () => {
  const done = aSession({ id: 's-5' as SessionId });
  const shelved = aSession({ id: 's-9' as SessionId });

  const columnNames = () =>
    screen.getAllByTestId('stage-column').map((column) => column.id.replace('board-column-', ''));

  it('renders all six lanes in pipeline order with Done and Archived holding nothing', () => {
    groups.current = [{ key: 'building', sessions: [session] }];
    const { container } = render(<StageBoard workspaceId={wsId} sessions={[session]} />);

    expect(columnNames()).toEqual([
      'building',
      'running',
      'attention',
      'review',
      'done',
      'archived',
    ]);
    expect(container.querySelector('[data-board-dock]')).toBeNull();
  });

  it('renders the Done and Archived cards in their own lanes without a click', () => {
    groups.current = [
      { key: 'building', sessions: [session] },
      { key: 'done', sessions: [done] },
    ];
    state.archivedSessions = { [wsId]: [shelved] };
    render(<StageBoard workspaceId={wsId} sessions={[session, done]} />);

    expect(screen.getByRole('button', { name: 'card s-5' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'card s-9' })).toBeDefined();
  });

  it('ignores a collapse value an older version stored', () => {
    localStorage.setItem(
      `goodboy:board-collapsed:v1:${wsId}`,
      JSON.stringify({ done: true, archived: true }),
    );
    render(<StageBoard workspaceId={wsId} sessions={[session]} />);

    expect(columnNames()).toContain('done');
    expect(columnNames()).toContain('archived');
  });

  it('asks for the archived list on every open', () => {
    render(<StageBoard workspaceId={wsId} sessions={[session]} />);

    expect(state.loadArchivedSessions).toHaveBeenCalledWith(wsId);
  });
});
