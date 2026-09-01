// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    pendingTitleFocusSessionId: null as string | null,
    clearPendingTitleFocus: vi.fn(),
    sessionGithub: {},
    sessionExternalTasks: {},
    setScriptsLensScope: vi.fn(),
    sessionProjectMounts: {} as Record<string, ReadonlyArray<{ projectId: string }>>,
    projects: [] as ReadonlyArray<{ id: string; kind: string }>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

vi.mock('../../hooks/useSessionTitleRename', () => ({
  useSessionTitleRename: () => ({
    editing: false,
    draft: '',
    maxLength: 120,
    error: null,
    start: vi.fn(),
    setDraft: vi.fn(),
    commit: vi.fn(),
    onKeyDown: vi.fn(),
  }),
}));

vi.mock('./EditorMenu', () => ({ EditorMenu: () => <button aria-label="Open worktree" /> }));
vi.mock('./SessionDestructiveActions', () => ({
  SessionDestructiveActions: () => <button aria-label="Session actions" />,
}));
vi.mock('./ContextChip', () => ({ ContextChip: () => <span>Context</span> }));
vi.mock('./SessionCostChip', () => ({
  SessionCostChip: () => <span data-testid="session-cost-chip" />,
}));
vi.mock('./LinkedWorkChips', () => ({ LinkedWorkChips: () => <span>Linked work</span> }));
vi.mock('./LinkIssueAction', () => ({ LinkIssueAction: () => <button>Link issue</button> }));
vi.mock('./ProjectMountRows', () => ({
  ProjectMountRows: () => <section aria-label="Mounted projects" />,
}));
vi.mock('./ProjectMountRows/MountProjectAction', () => ({
  MountProjectAction: () => <button aria-label="Mount a project" />,
}));
vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return { ...actual, Tooltip: ({ children }: { readonly children: ReactNode }) => children };
});

import { HeaderBand } from './HeaderBand';

afterEach(cleanup);

const session = {
  id: 'session-1',
  workspaceId: 'workspace-1',
  goal: 'Refactor auth',
} as Session;

describe('HeaderBand', () => {
  beforeEach(() => {
    store.pendingTitleFocusSessionId = null;
    store.clearPendingTitleFocus.mockClear();
    store.setScriptsLensScope.mockClear();
    store.sessionProjectMounts = {};
    store.projects = [];
  });

  it('puts Scripts first in the title actions and opens it without scope', () => {
    const onSelectLens = vi.fn();
    render(<HeaderBand session={session} onSelectLens={onSelectLens} goal={<div>Goal</div>} />);

    expect(screen.getByRole('button', { name: 'Mount a project' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /terminal/i })).toBeNull();
    const scripts = screen.getByRole('button', { name: 'Scripts' });
    expect(scripts.parentElement?.firstElementChild).toBe(scripts);

    fireEvent.click(scripts);

    expect(store.setScriptsLensScope).toHaveBeenCalledWith({ scope: null });
    expect(onSelectLens).toHaveBeenCalledWith('scripts');
  });

  it('renders mounted projects before the goal', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    const projects = screen.getByRole('region', { name: 'Mounted projects' });
    const goal = screen.getByText('Goal');
    expect(projects.compareDocumentPosition(goal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the folder action for a session with no mount', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    expect(screen.getByRole('button', { name: 'Open worktree' })).toBeDefined();
  });

  it('keeps the folder action when every mount is a plain folder', () => {
    store.sessionProjectMounts = { 'session-1': [{ projectId: 'docs' }] };
    store.projects = [{ id: 'docs', kind: 'folder' }];
    render(<HeaderBand session={session} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    expect(screen.getByRole('button', { name: 'Open worktree' })).toBeDefined();
  });

  it('drops the folder action once a repo is mounted, since the row owns it', () => {
    store.sessionProjectMounts = { 'session-1': [{ projectId: 'api' }] };
    store.projects = [{ id: 'api', kind: 'repo' }];
    render(<HeaderBand session={session} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    expect(screen.queryByRole('button', { name: 'Open worktree' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Mount a project' })).toBeDefined();
  });

  it('renders the session cost at the right edge of the context row', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    const context = screen.getByText('Context');
    const chip = screen.getByTestId('session-cost-chip');
    expect(context.parentElement).toBe(chip.parentElement?.parentElement);
    expect(chip.parentElement?.className).toContain('ml-auto');
    expect(chip.parentElement?.lastElementChild).toBe(chip);
  });
});
