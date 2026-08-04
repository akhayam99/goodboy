// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session, Workspace, WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';

const { state, gitStatus } = vi.hoisted(() => ({
  state: {
    boardReady: true,
    archivedSessions: {} as Record<string, ReadonlyArray<Session>>,
    loadArchivedSessions: vi.fn(),
    workspaces: [] as ReadonlyArray<Workspace>,
  },
  gitStatus: { current: null as WorkspaceGitStatus | null },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: (selector: (s: typeof state) => unknown) => selector(state),
  useStageGroupedSessions: () => [],
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
  StageColumn: ({ spec }: { spec: { kind: string; stage?: string } }) => (
    <div data-testid="stage-column">{spec.kind === 'stage' ? spec.stage : 'archived'}</div>
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

const statusOf = (state: WorkspaceGitStatus['state']): WorkspaceGitStatus => ({
  state,
  branch: null,
  headSubject: null,
  ahead: 0,
  behind: 0,
  staged: 0,
  unstaged: 0,
  untracked: 0,
  changed: 0,
  hasUpstream: false,
});

beforeEach(() => {
  state.boardReady = true;
  state.archivedSessions = {};
  state.loadArchivedSessions = vi.fn();
  state.workspaces = [workspace];
  gitStatus.current = null;
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
