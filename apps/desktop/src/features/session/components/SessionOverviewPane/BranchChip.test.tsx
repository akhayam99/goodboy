// @vitest-environment happy-dom

import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

type Mount = {
  readonly projectId: string;
  readonly mountName: string;
  readonly worktreePath: string;
  readonly branch: string;
};

const { store, toast } = vi.hoisted(() => ({
  store: {
    sessions: [] as ReadonlyArray<{ id: string; activeProjectId?: string }>,
    projects: [] as ReadonlyArray<{ id: string; workspaceId: string; kind: string }>,
    sessionProjectMounts: {} as Record<string, ReadonlyArray<Mount>>,
    sessionActiveProject: {} as Record<string, string>,
  },
  toast: { showToast: vi.fn() },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: typeof store) => T) => selector(store),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => toast,
}));

vi.mock('../../../worktree/BranchSwitchPanel', () => ({
  BranchSwitchPanel: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="branch-switch-panel" data-session={sessionId} />
  ),
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

import { BranchChip } from './BranchChip';

const SESSION_ID = 'sess-1' as SessionId;

const mount = (over: Partial<Mount> = {}): Mount => ({
  projectId: 'project-1',
  mountName: 'api',
  worktreePath: '/worktrees/api',
  branch: 'goodboy/x',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  store.sessions = [];
  store.projects = [{ id: 'project-1', workspaceId: 'ws-1', kind: 'repo' }];
  store.sessionProjectMounts = { [SESSION_ID]: [mount()] };
  store.sessionActiveProject = { [SESSION_ID]: 'project-1' };
});

afterEach(cleanup);

describe('BranchChip', () => {
  it('copies the branch name on click', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<BranchChip sessionId={SESSION_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy branch goodboy/x' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('goodboy/x'));
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith('success', 'branch copied'));
  });

  it('opens the branch switch panel from the pencil', () => {
    render(<BranchChip sessionId={SESSION_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch branch' }));

    expect(screen.getByTestId('branch-switch-panel').getAttribute('data-session')).toBe(SESSION_ID);
  });

  it('keeps the pencil off non-repo mounts', () => {
    store.projects = [{ id: 'project-1', workspaceId: 'ws-1', kind: 'folder' }];
    render(<BranchChip sessionId={SESSION_ID} />);

    expect(screen.getByRole('button', { name: 'Copy branch goodboy/x' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Switch branch' })).toBeNull();
  });

  it('stays out of the header on a branchless mount', () => {
    store.sessionProjectMounts = { [SESSION_ID]: [mount({ branch: '' })] };
    render(<BranchChip sessionId={SESSION_ID} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('follows the primary project', () => {
    store.projects = [
      { id: 'project-1', workspaceId: 'ws-1', kind: 'repo' },
      { id: 'project-2', workspaceId: 'ws-1', kind: 'repo' },
    ];
    store.sessionProjectMounts = {
      [SESSION_ID]: [
        mount(),
        mount({ projectId: 'project-2', mountName: 'web', branch: 'goodboy/y' }),
      ],
    };
    store.sessionActiveProject = { [SESSION_ID]: 'project-2' };
    render(<BranchChip sessionId={SESSION_ID} />);

    expect(screen.getByRole('button', { name: 'Copy branch goodboy/y' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Copy branch goodboy/x' })).toBeNull();
  });
});
