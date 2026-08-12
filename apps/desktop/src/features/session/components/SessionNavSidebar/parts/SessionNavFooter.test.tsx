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

vi.mock('../../SessionWorkspace/parts/SessionGitActions', () => ({
  SessionGitActions: ({ density = 'full' }: { readonly density?: 'compact' | 'full' }) => (
    <button type="button" aria-label="branch actions">
      {density === 'full' ? 'Branch' : null}
    </button>
  ),
}));

import { SessionNavFooter } from './SessionNavFooter';

const session = (over: Record<string, unknown> = {}): Session =>
  ({ id: 'sess-1', goal: 'refactor auth', ...over }) as unknown as Session;

beforeEach(() => {
  state.archiveTask.mockClear();
  state.deleteTask.mockClear();
  state.unarchiveTask.mockClear();
  toastMock.mockReset();
});
afterEach(cleanup);

describe('SessionNavFooter', () => {
  it('orders the editor, archive, and delete controls across the footer', () => {
    render(<SessionNavFooter session={session()} />);
    const editor = screen.getByRole('button', { name: /open worktree/i });
    const archive = screen.getByRole('button', { name: /archive session/i });
    const remove = screen.getByRole('button', { name: /delete session/i });

    expect(editor.compareDocumentPosition(archive) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(archive.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('leaves the project scope to its own row above the content', () => {
    render(<SessionNavFooter session={session()} />);

    expect(screen.queryByRole('button', { name: /active project/i })).toBeNull();
    expect(screen.queryByRole('tablist', { name: /active project/i })).toBeNull();
  });

  it('arms then confirms archive inline without firing on the first click', () => {
    render(<SessionNavFooter session={session()} />);
    fireEvent.click(screen.getByRole('button', { name: /archive session/i }));
    expect(state.archiveTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^archive session$/i }));
    expect(state.archiveTask).toHaveBeenCalledWith('sess-1');
  });

  it('arms then confirms delete inline without firing on the first click', () => {
    render(<SessionNavFooter session={session()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete session/i }));
    expect(state.deleteTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^delete session$/i }));
    expect(state.deleteTask).toHaveBeenCalledWith('sess-1');
  });

  it('cancel disarms the confirm without deleting', () => {
    render(<SessionNavFooter session={session()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete session/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(state.deleteTask).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /delete session/i })).toBeDefined();
  });

  it('hides neighboring control labels while delete confirm is armed and keeps names', () => {
    render(<SessionNavFooter session={session()} />);
    expect(screen.getByText('Open')).toBeDefined();
    expect(screen.getByText('Branch')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /delete session/i }));

    expect(screen.getByRole('button', { name: /open worktree/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /branch actions/i })).toBeDefined();
    expect(screen.queryByText('Open')).toBeNull();
    expect(screen.queryByText('Branch')).toBeNull();
  });

  it('restores neighboring control labels after disarming delete confirm', () => {
    render(<SessionNavFooter session={session()} />);

    fireEvent.click(screen.getByRole('button', { name: /delete session/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.getByRole('button', { name: /open worktree/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /branch actions/i })).toBeDefined();
    expect(screen.getByText('Open')).toBeDefined();
    expect(screen.getByText('Branch')).toBeDefined();
  });

  it('shows an unarchive control for an archived session instead of the archive control', () => {
    render(<SessionNavFooter session={session({ archivedAt: '2026-07-01T00:00:00.000Z' })} />);
    fireEvent.click(screen.getByRole('button', { name: /unarchive session/i }));
    expect(state.unarchiveTask).toHaveBeenCalledWith('sess-1');
    expect(screen.queryByRole('button', { name: /^archive session$/i })).toBeNull();
  });

  it('wraps controls onto a second line instead of scrolling them out of reach in a narrow rail', () => {
    render(<SessionNavFooter session={session()} />);
    const editor = screen.getByRole('button', { name: /open worktree/i });
    const archive = screen.getByRole('button', { name: /archive session/i });
    const remove = screen.getByRole('button', { name: /delete session/i });

    expect(editor.closest('[class*="overflow-x-auto"]')).toBeNull();
    const row = editor.closest('[class*="flex-wrap"]');
    expect(row).not.toBeNull();
    expect(row?.contains(archive)).toBe(true);
    expect(row?.contains(remove)).toBe(true);
  });
});
