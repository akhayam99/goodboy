// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { archiveMock } = vi.hoisted(() => ({
  archiveMock: vi.fn(async () => undefined),
}));

vi.mock('../../hooks/useSessionArchive', () => ({
  useSessionArchive: () => ({ archive: archiveMock, restore: vi.fn() }),
}));

vi.mock('../DeleteSessionConfirm', () => ({
  DeleteSessionConfirm: ({ surface }: { surface?: string }) => (
    <div data-testid="delete-confirm" data-surface={surface} />
  ),
}));

import { SessionActionsMenu } from './SessionActionsMenu';

const session = { id: 'sess-1', goal: 'Untitled session', archivedAt: null } as unknown as Session;

beforeEach(() => {
  archiveMock.mockClear();
});
afterEach(cleanup);

describe('SessionActionsMenu', () => {
  it('archives from the menu', () => {
    render(<SessionActionsMenu session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Session actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Archive session/ }));

    expect(archiveMock).toHaveBeenCalledWith({ sessions: [session] });
  });

  it('swaps the menu for a plain delete confirmation in place', () => {
    render(<SessionActionsMenu session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Session actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete session/ }));

    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.getByTestId('delete-confirm').getAttribute('data-surface')).toBe('plain');
    expect(screen.getByRole('dialog', { name: 'Delete session?' })).toBeDefined();
  });
});
