// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    unarchiveTask: vi.fn(async () => undefined),
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

import { SessionDestructiveActions } from './SessionDestructiveActions';

const session = (over: Record<string, unknown> = {}): Session =>
  ({ id: 'sess-1', goal: 'refactor auth', archivedAt: null, ...over }) as unknown as Session;

const openMenu = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /session actions/i }));
};

beforeEach(() => {
  state.unarchiveTask.mockClear();
  state.unarchiveTask.mockResolvedValue(undefined);
  toastMock.mockReset();
});
afterEach(cleanup);

describe('SessionDestructiveActions', () => {
  it('shows an unarchive control for an archived session instead of the archive control', () => {
    render(
      <SessionDestructiveActions session={session({ archivedAt: '2026-07-01T00:00:00.000Z' })} />,
    );
    openMenu();
    expect(screen.getByRole('menuitem', { name: /unarchive session/i })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /^archive session/i })).toBeNull();
  });

  it('shows an archive control for a non-archived session', () => {
    render(<SessionDestructiveActions session={session()} />);
    openMenu();
    expect(screen.getByRole('menuitem', { name: /^archive session/i })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /unarchive session/i })).toBeNull();
  });

  it('surfaces an unarchive failure as a toast', async () => {
    state.unarchiveTask.mockRejectedValueOnce(new Error('locked'));
    render(
      <SessionDestructiveActions session={session({ archivedAt: '2026-07-01T00:00:00.000Z' })} />,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /unarchive session/i }));
    await Promise.resolve();
    await Promise.resolve();
    expect(toastMock).toHaveBeenCalledWith('error', expect.stringContaining("couldn't unarchive"));
  });

  it('dispatches the open-archive-session event when the archive control is pressed', () => {
    const onOpen = vi.fn();
    window.addEventListener('goodboy:open-archive-session', onOpen);
    render(<SessionDestructiveActions session={session()} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /^archive session/i }));
    window.removeEventListener('goodboy:open-archive-session', onOpen);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('dispatches the open-delete-session event when the delete control is pressed', () => {
    const onOpen = vi.fn();
    window.addEventListener('goodboy:open-delete-session', onOpen);
    render(<SessionDestructiveActions session={session()} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /delete session/i }));
    window.removeEventListener('goodboy:open-delete-session', onOpen);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('renders the delete item as destructive, and the archive item as plain', () => {
    render(<SessionDestructiveActions session={session()} />);
    openMenu();
    const deleteItem = screen.getByRole('menuitem', { name: /delete session/i });
    const archiveItem = screen.getByRole('menuitem', { name: /^archive session/i });
    expect(deleteItem.className).toContain('text-danger');
    expect(archiveItem.className).not.toContain('text-danger');
  });

  it('is reachable behind a single overflow trigger, not as bare buttons beside the title', () => {
    render(<SessionDestructiveActions session={session()} />);
    expect(screen.queryByRole('button', { name: /^archive session/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^delete session$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /session actions/i })).toBeTruthy();
  });
});
