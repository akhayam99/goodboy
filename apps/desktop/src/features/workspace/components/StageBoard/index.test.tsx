// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, Workspace, WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';

const { state, gitStatus, groups } = vi.hoisted(() => ({
  state: {
    boardReady: true,
    archivedSessions: {} as Record<string, ReadonlyArray<Session>>,
    loadArchivedSessions: vi.fn(),
    workspaces: [] as ReadonlyArray<Workspace>,
    bulkUnarchiveTask: vi.fn(async () => undefined),
  },
  gitStatus: { current: null as WorkspaceGitStatus | null },
  groups: { current: [] as ReadonlyArray<{ key: string; sessions: ReadonlyArray<Session> }> },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: (selector: (s: typeof state) => unknown) => selector(state),
  useStageGroupedSessions: () => groups.current,
}));

vi.mock('../../hooks/useWorkspaceGitStatus', () => ({
  useWorkspaceGitStatus: () => gitStatus.current,
}));

vi.mock('../WorkspaceGitPanel', () => ({
  WorkspaceGitPanel: ({ status }: { status: WorkspaceGitStatus }) => (
    <div data-testid="git-panel">{status.state}</div>
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
      handleItemClick: (id: string, event: { altKey: boolean }) => void;
    };
  }) => (
    <div data-testid="stage-column">
      {spec.kind === 'stage' ? spec.stage : 'archived'}
      {sessions.map((entry) => (
        <button
          key={entry.id}
          type="button"
          data-select-id={entry.id}
          aria-label={`card ${entry.id}`}
          onClick={(event) => selection.handleItemClick(entry.id, event)}
        />
      ))}
    </div>
  ),
}));

vi.mock('../../../session/components/ArchiveSessionConfirm', () => ({
  ArchiveSessionConfirm: () => null,
}));
vi.mock('../../../session/components/DeleteSessionConfirm', () => ({
  DeleteSessionConfirm: () => null,
}));
vi.mock('../../../../shared/components/DogMascot', () => ({ DogMascot: () => <div /> }));

import { StageBoard } from './index';

const session = { id: 's-1' } as Session;
const wsId = 'ws-a' as WorkspaceId;
const onCreate = vi.fn();

const workspace = { id: wsId, kind: 'repo', rootPath: '/tmp/fresh-idea' } as Workspace;

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

beforeEach(() => {
  state.boardReady = true;
  state.archivedSessions = {};
  state.loadArchivedSessions = vi.fn();
  state.workspaces = [workspace];
  gitStatus.current = null;
  groups.current = [];
});
afterEach(cleanup);

describe('StageBoard loading gate', () => {
  it('shows the skeleton board while boardReady is false, hiding columns and empty state', () => {
    state.boardReady = false;
    render(<StageBoard workspaceId={wsId} sessions={[session]} onCreateSession={onCreate} />);
    expect(screen.getByLabelText('Loading board')).toBeDefined();
    expect(screen.queryByTestId('stage-column')).toBeNull();
    expect(screen.queryByText('Start your first session')).toBeNull();
  });

  it('renders the empty state once ready with no sessions', () => {
    render(<StageBoard workspaceId={wsId} sessions={[]} onCreateSession={onCreate} />);
    expect(screen.queryByLabelText('Loading board')).toBeNull();
    expect(screen.getByText('Start your first session')).toBeDefined();
    expect(screen.queryByText('Stage board')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'New session' })).toHaveLength(1);
  });

  it('renders stage columns once ready with sessions', () => {
    render(<StageBoard workspaceId={wsId} sessions={[session]} onCreateSession={onCreate} />);
    expect(screen.queryByLabelText('Loading board')).toBeNull();
    expect(screen.getAllByTestId('stage-column').length).toBeGreaterThan(0);
    expect(screen.getByText('Stage board')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'New session' })).toHaveLength(1);
  });
});

describe('StageBoard git gate', () => {
  it('replaces the start-a-session invitation with the git panel when there is no repository', () => {
    gitStatus.current = statusOf('absent');
    render(<StageBoard workspaceId={wsId} sessions={[]} onCreateSession={onCreate} />);
    expect(screen.getByTestId('git-panel').textContent).toBe('absent');
    expect(screen.queryByText('Start your first session')).toBeNull();
    expect(screen.queryByRole('button', { name: 'New session' })).toBeNull();
  });

  it('offers New session as unavailable rather than failing when a repository is missing', () => {
    gitStatus.current = statusOf('unborn');
    render(<StageBoard workspaceId={wsId} sessions={[session]} onCreateSession={onCreate} />);
    const button = screen.getByRole('button', { name: 'New session' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('title')).toBe(
      'This project needs a git repository with one commit first',
    );
  });

  it('leaves the board alone once the repository is ready', () => {
    gitStatus.current = statusOf('ready');
    render(<StageBoard workspaceId={wsId} sessions={[session]} onCreateSession={onCreate} />);
    expect(screen.getByTestId('git-panel').textContent).toBe('ready');
    expect(screen.getByRole('button', { name: 'New session' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('shows no git surface and no gate when the workspace reports no git state', () => {
    gitStatus.current = null;
    render(<StageBoard workspaceId={wsId} sessions={[]} onCreateSession={onCreate} />);
    expect(screen.queryByTestId('git-panel')).toBeNull();
    expect(screen.getByText('Start your first session')).toBeDefined();
    expect(screen.getByRole('button', { name: 'New session' }).hasAttribute('disabled')).toBe(
      false,
    );
  });
});

describe('StageBoard selection', () => {
  const other = { id: 's-2' } as Session;
  const shelved = { id: 's-9' } as Session;

  it('offers the alt-click hint only once the board holds more than one session', () => {
    render(<StageBoard workspaceId={wsId} sessions={[session]} onCreateSession={onCreate} />);
    expect(screen.queryByText(/lasso/)).toBeNull();

    cleanup();
    render(
      <StageBoard workspaceId={wsId} sessions={[session, other]} onCreateSession={onCreate} />,
    );
    expect(screen.getByText('⌥click to select · drag to lasso')).toBeDefined();
  });

  it('raises a single bulk bar for the whole board, not one per column', () => {
    groups.current = [{ key: 'building', sessions: [session, other] }];
    render(
      <StageBoard workspaceId={wsId} sessions={[session, other]} onCreateSession={onCreate} />,
    );
    expect(screen.queryByText(/selected/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'card s-1' }), { altKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'card s-2' }), { altKey: true });

    expect(screen.getAllByText('2 selected')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Archive \(2\)$/ })).toBeDefined();
  });

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
    render(
      <StageBoard workspaceId={wsId} sessions={[session, other]} onCreateSession={onCreate} />,
    );

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
    render(
      <StageBoard workspaceId={wsId} sessions={[session, other]} onCreateSession={onCreate} />,
    );

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

  it('never mixes the archived scope with the active one', () => {
    groups.current = [{ key: 'building', sessions: [session] }];
    state.archivedSessions = { [wsId]: [shelved] };
    render(<StageBoard workspaceId={wsId} sessions={[session]} onCreateSession={onCreate} />);

    fireEvent.click(screen.getByRole('button', { name: 'card s-1' }), { altKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'card s-9' }), { altKey: true });

    expect(screen.getByText('1 selected')).toBeDefined();
    expect(screen.getByRole('button', { name: /^Restore \(1\)$/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Archive/ })).toBeNull();
  });

  it('keeps the active-lane hits when a lasso spans into the archived column', () => {
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
    render(
      <StageBoard workspaceId={wsId} sessions={[session, other]} onCreateSession={onCreate} />,
    );

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

    expect(screen.getByText('2 selected')).toBeDefined();
    expect(screen.getByRole('button', { name: /^Archive \(2\)$/ })).toBeDefined();
  });
});
