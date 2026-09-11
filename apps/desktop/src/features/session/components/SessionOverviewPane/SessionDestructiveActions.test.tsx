// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { archiveMock, restoreMock } = vi.hoisted(() => ({
  archiveMock: vi.fn(async () => undefined),
  restoreMock: vi.fn(async () => undefined),
}));

vi.mock('../../hooks/useSessionArchive', () => ({
  useSessionArchive: () => ({ archive: archiveMock, restore: restoreMock }),
}));

vi.mock('../DeleteSessionConfirm', () => ({
  DeleteSessionConfirm: ({ onClose, className }: { onClose: () => void; className?: string }) => (
    <div data-testid="delete-confirm" className={className}>
      <button type="button" onClick={onClose}>
        cancel delete
      </button>
    </div>
  ),
}));

import { SessionDestructiveActions } from './SessionDestructiveActions';

const session = (over: Record<string, unknown> = {}): Session =>
  ({ id: 'sess-1', goal: 'refactor auth', archivedAt: null, ...over }) as unknown as Session;

beforeEach(() => {
  archiveMock.mockClear();
  restoreMock.mockClear();
});
afterEach(cleanup);

describe('SessionDestructiveActions', () => {
  it('shows an unarchive control for an archived session instead of the archive control', () => {
    render(
      <SessionDestructiveActions session={session({ archivedAt: '2026-07-01T00:00:00.000Z' })} />,
    );
    expect(screen.getByRole('button', { name: /unarchive session/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^archive session/i })).toBeNull();
  });

  it('shows an archive control for a non-archived session', () => {
    render(<SessionDestructiveActions session={session()} />);
    expect(screen.getByRole('button', { name: /^archive session/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /unarchive session/i })).toBeNull();
  });

  it('archives on a single click without a confirmation step', () => {
    const target = session();
    render(<SessionDestructiveActions session={target} />);
    fireEvent.click(screen.getByRole('button', { name: /^archive session/i }));
    expect(archiveMock).toHaveBeenCalledWith({ sessions: [target] });
    expect(restoreMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('delete-confirm')).toBeNull();
  });

  it('restores on a single click for an archived session', () => {
    const target = session({ archivedAt: '2026-07-01T00:00:00.000Z' });
    render(<SessionDestructiveActions session={target} />);
    fireEvent.click(screen.getByRole('button', { name: /unarchive session/i }));
    expect(restoreMock).toHaveBeenCalledWith({ sessions: [target] });
    expect(archiveMock).not.toHaveBeenCalled();
  });

  it('takes two gestures to delete, arming a confirmation attached to the trigger', () => {
    render(<SessionDestructiveActions session={session()} />);
    expect(screen.queryByTestId('delete-confirm')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /delete session/i }));

    const confirm = screen.getByTestId('delete-confirm');
    expect(confirm.className).toContain('absolute');
    expect(
      screen.getByRole('button', { name: /delete session/i }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('disarms the delete confirmation on Escape', () => {
    render(<SessionDestructiveActions session={session()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete session/i }));
    expect(screen.queryByTestId('delete-confirm')).not.toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('delete-confirm')).toBeNull();
  });

  it('reads both controls out of the overflow menu and onto the title row', () => {
    render(<SessionDestructiveActions session={session()} />);
    expect(screen.queryByRole('button', { name: /session actions/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^archive session/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete session/i })).toBeTruthy();
  });

  it('stays neutral at rest and turns destructive only once armed', () => {
    const restingDanger = /(^|\s)text-danger(\s|$)/;
    render(<SessionDestructiveActions session={session()} />);
    const deleteButton = screen.getByRole('button', { name: /delete session/i });

    expect(deleteButton.className).not.toMatch(restingDanger);
    expect(deleteButton.className).toMatch(/hover:text-danger/);
    expect(screen.getByRole('button', { name: /^archive session/i }).className).not.toContain(
      'text-danger',
    );

    fireEvent.click(deleteButton);

    expect(screen.getByRole('button', { name: /delete session/i }).className).toMatch(
      restingDanger,
    );
    expect(
      screen.getByRole('button', { name: /delete session/i }).getAttribute('aria-expanded'),
    ).toBe('true');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByRole('button', { name: /delete session/i }).className).not.toMatch(
      restingDanger,
    );
  });
});
