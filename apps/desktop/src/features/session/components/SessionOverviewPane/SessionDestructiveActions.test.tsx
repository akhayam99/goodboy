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
    expect(screen.getByRole('button', { name: /unarchive session/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^archive session$/i })).toBeNull();
  });

  it('shows an archive control for a non-archived session', () => {
    render(<SessionDestructiveActions session={session()} />);
    expect(screen.getByRole('button', { name: /archive session/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /unarchive session/i })).toBeNull();
  });

  it('surfaces an unarchive failure as a toast', async () => {
    state.unarchiveTask.mockRejectedValueOnce(new Error('locked'));
    render(
      <SessionDestructiveActions session={session({ archivedAt: '2026-07-01T00:00:00.000Z' })} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /unarchive session/i }));
    await Promise.resolve();
    await Promise.resolve();
    expect(toastMock).toHaveBeenCalledWith('error', expect.stringContaining("couldn't unarchive"));
  });

  it('dispatches the open-archive-session event when the archive control is pressed', () => {
    const onOpen = vi.fn();
    window.addEventListener('goodboy:open-archive-session', onOpen);
    render(<SessionDestructiveActions session={session()} />);
    fireEvent.click(screen.getByRole('button', { name: /archive session/i }));
    window.removeEventListener('goodboy:open-archive-session', onOpen);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('dispatches the open-delete-session event when the delete control is pressed', () => {
    const onOpen = vi.fn();
    window.addEventListener('goodboy:open-delete-session', onOpen);
    render(<SessionDestructiveActions session={session()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete session/i }));
    window.removeEventListener('goodboy:open-delete-session', onOpen);
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
