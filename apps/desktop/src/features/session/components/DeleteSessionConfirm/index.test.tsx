// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

type InlineConfirmProps = {
  readonly role: string;
  readonly title: string;
  readonly children: ReactNode;
  readonly altAction?: { readonly label: string; readonly onClick: () => void };
};

vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
  InlineConfirm: ({ role, title, children, altAction }: InlineConfirmProps) => (
    <div data-confirm-role={role}>
      {title}
      {children}
      {altAction != null && (
        <button type="button" onClick={altAction.onClick}>
          {altAction.label}
        </button>
      )}
    </div>
  ),
  formatError: (err: unknown) => String(err),
}));

const { archiveMock, restoreMock } = vi.hoisted(() => ({
  archiveMock: vi.fn(async () => undefined),
  restoreMock: vi.fn(async () => undefined),
}));

vi.mock('../../hooks/useSessionArchive', () => ({
  useSessionArchive: () => ({ archive: archiveMock, restore: restoreMock }),
}));

const { state } = vi.hoisted(() => ({
  state: {
    deleteTask: vi.fn(async () => undefined),
    archiveTask: vi.fn(async () => undefined),
    workspaces: [] as ReadonlyArray<{ id: string; kind: string }>,
    sessionBranches: {} as Record<string, string>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

import { DeleteSessionConfirm } from '.';

afterEach(() => {
  cleanup();
  state.workspaces = [];
  state.sessionBranches = {};
  state.archiveTask.mockClear();
  archiveMock.mockClear();
});

describe('DeleteSessionConfirm branch-aware copy', () => {
  it('warns about the branch-preserving path for a repo session with a branch', () => {
    state.workspaces = [{ id: 'workspace-1', kind: 'repo' }];
    state.sessionBranches = { 'session-1': 'feature/x' };
    const session = { id: 'session-1', workspaceId: 'workspace-1', goal: 'Ship it' } as never;

    render(<DeleteSessionConfirm session={session} onClose={vi.fn()} />);

    expect(
      screen.getByText('This cannot be undone. To keep the history, archive instead.'),
    ).toBeDefined();
    expect(
      screen.queryByText(
        'This cannot be undone. Saved file versions are deleted with this session.',
      ),
    ).toBeNull();
  });

  it('warns about permanent file-version loss for a branchless session', () => {
    state.workspaces = [{ id: 'workspace-1', kind: 'repo' }];
    state.sessionBranches = { 'session-1': '' };
    const session = { id: 'session-1', workspaceId: 'workspace-1', goal: 'Ship it' } as never;

    render(<DeleteSessionConfirm session={session} onClose={vi.fn()} />);

    expect(
      screen.getByText('This cannot be undone. Saved file versions are deleted with this session.'),
    ).toBeDefined();
    expect(
      screen.queryByText('This cannot be undone. To keep the history, archive instead.'),
    ).toBeNull();
  });
});

describe('DeleteSessionConfirm archive instead', () => {
  it('archives through the shared path, so the safer option still offers an undo', async () => {
    const session = {
      id: 'session-1',
      workspaceId: 'workspace-1',
      goal: 'Ship it',
      archivedAt: null,
    } as never;

    render(<DeleteSessionConfirm session={session} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archive instead' }));

    await waitFor(() => expect(archiveMock).toHaveBeenCalledWith({ sessions: [session] }));
    expect(state.archiveTask).not.toHaveBeenCalled();
  });
});
