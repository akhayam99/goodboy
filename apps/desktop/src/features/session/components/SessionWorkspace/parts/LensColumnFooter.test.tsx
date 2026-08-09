// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    sessionMounts: {},
    sessionActiveMount: {},
    setSessionActiveMount: vi.fn(async () => undefined),
    archiveTask: vi.fn(async () => undefined),
    deleteTask: vi.fn(async () => undefined),
    unarchiveTask: vi.fn(async () => undefined),
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

vi.mock('../../SessionOverviewPane/EditorMenu', () => ({
  EditorMenu: ({ density = 'full' }: { readonly density?: 'compact' | 'full' }) => (
    <button type="button" aria-label="open worktree">
      {density === 'full' ? 'Open' : null}
    </button>
  ),
}));

vi.mock('./SessionGitActions', () => ({
  SessionGitActions: ({ density = 'full' }: { readonly density?: 'compact' | 'full' }) => (
    <button type="button" aria-label="branch actions">
      {density === 'full' ? 'Branch' : null}
    </button>
  ),
}));

vi.mock('../../ProjectSwitcher', () => ({
  ProjectSwitcher: ({ density = 'full' }: { readonly density?: 'compact' | 'full' }) => (
    <button type="button" aria-label="Active project">
      {density === 'full' ? 'Project' : null}
    </button>
  ),
}));

import { LensColumnFooter } from './LensColumnFooter';

const session = (over: Record<string, unknown> = {}): Session =>
  ({ id: 'sess-1', goal: 'refactor auth', ...over }) as unknown as Session;

beforeEach(() => {
  state.archiveTask.mockClear();
  state.deleteTask.mockClear();
  state.unarchiveTask.mockClear();
  toastMock.mockReset();
});
afterEach(cleanup);

describe('LensColumnFooter', () => {
  it('orders the editor, archive, and delete controls across the footer', () => {
    render(<LensColumnFooter session={session()} />);
    const project = screen.getByRole('button', { name: /active project/i });
    const editor = screen.getByRole('button', { name: /open worktree/i });
    const archive = screen.getByRole('button', { name: /archive session/i });
    const remove = screen.getByRole('button', { name: /delete session/i });

    expect(project.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(editor.compareDocumentPosition(archive) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(archive.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('arms then confirms archive inline without firing on the first click', () => {
    render(<LensColumnFooter session={session()} />);
    fireEvent.click(screen.getByRole('button', { name: /archive session/i }));
    expect(state.archiveTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^archive session$/i }));
    expect(state.archiveTask).toHaveBeenCalledWith('sess-1');
  });

  it('arms then confirms delete inline without firing on the first click', () => {
    render(<LensColumnFooter session={session()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete session/i }));
    expect(state.deleteTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^delete session$/i }));
    expect(state.deleteTask).toHaveBeenCalledWith('sess-1');
  });

  it('cancel disarms the confirm without deleting', () => {
    render(<LensColumnFooter session={session()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete session/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(state.deleteTask).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /delete session/i })).toBeDefined();
  });

  it('hides neighboring control labels while delete confirm is armed and keeps names', () => {
    render(<LensColumnFooter session={session()} />);
    expect(screen.getByText('Project')).toBeDefined();
    expect(screen.getByText('Open')).toBeDefined();
    expect(screen.getByText('Branch')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /delete session/i }));

    expect(screen.getByRole('button', { name: /active project/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /open worktree/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /branch actions/i })).toBeDefined();
    expect(screen.queryByText('Project')).toBeNull();
    expect(screen.queryByText('Open')).toBeNull();
    expect(screen.queryByText('Branch')).toBeNull();
  });

  it('restores neighboring control labels after disarming delete confirm', () => {
    render(<LensColumnFooter session={session()} />);

    fireEvent.click(screen.getByRole('button', { name: /delete session/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.getByRole('button', { name: /active project/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /open worktree/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /branch actions/i })).toBeDefined();
    expect(screen.getByText('Project')).toBeDefined();
    expect(screen.getByText('Open')).toBeDefined();
    expect(screen.getByText('Branch')).toBeDefined();
  });

  it('shows an unarchive control for an archived session instead of the archive control', () => {
    render(<LensColumnFooter session={session({ archivedAt: '2026-07-01T00:00:00.000Z' })} />);
    fireEvent.click(screen.getByRole('button', { name: /unarchive session/i }));
    expect(state.unarchiveTask).toHaveBeenCalledWith('sess-1');
    expect(screen.queryByRole('button', { name: /^archive session$/i })).toBeNull();
  });

  it('wraps every control in a horizontal scroll container so an unbounded project switcher cannot push archive or delete out of reach', () => {
    render(<LensColumnFooter session={session()} />);
    const project = screen.getByRole('button', { name: /active project/i });
    const archive = screen.getByRole('button', { name: /archive session/i });
    const remove = screen.getByRole('button', { name: /delete session/i });

    const scrollContainer = project.closest('[class*="overflow-x-auto"]');
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer?.contains(archive)).toBe(true);
    expect(scrollContainer?.contains(remove)).toBe(true);
  });
});
