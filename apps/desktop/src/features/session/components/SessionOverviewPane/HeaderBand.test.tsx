// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    pendingTitleFocusSessionId: null as string | null,
    clearPendingTitleFocus: vi.fn(),
    sessionGithub: {},
    sessionExternalTasks: {},
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
  });

  it('puts mount with the title actions and removes terminal and scripts shortcuts', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    expect(screen.getByRole('button', { name: 'Mount a project' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /terminal/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /scripts/i })).toBeNull();
  });

  it('renders mounted projects before the goal', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} goal={<div>Goal</div>} />);

    const projects = screen.getByRole('region', { name: 'Mounted projects' });
    const goal = screen.getByText('Goal');
    expect(projects.compareDocumentPosition(goal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
