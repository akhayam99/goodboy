// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

type InlineConfirmProps = {
  readonly role: string;
  readonly title: string;
  readonly children: ReactNode;
};

vi.mock('@goodboy/ui', () => ({
  InlineConfirm: ({ role, title, children }: InlineConfirmProps) => (
    <div data-confirm-role={role}>
      {title}
      {children}
    </div>
  ),
  formatError: (err: unknown) => String(err),
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
    state.workspaces = [{ id: 'workspace-1', kind: 'simple' }];
    state.sessionBranches = {};
    const session = { id: 'session-1', workspaceId: 'workspace-1', goal: 'Ship it' } as never;

    render(<DeleteSessionConfirm session={session} onClose={vi.fn()} />);

    expect(
      screen.getByText('This cannot be undone. Saved file versions are deleted with this session.'),
    ).toBeDefined();
    expect(
      screen.queryByText('This cannot be undone. To keep the history, archive instead.'),
    ).toBeNull();
  });

  it('renders two genuinely different warning strings across the two variants', () => {
    state.workspaces = [{ id: 'workspace-1', kind: 'repo' }];
    state.sessionBranches = { 'session-1': 'feature/x' };
    const branchSession = { id: 'session-1', workspaceId: 'workspace-1', goal: 'A' } as never;
    const { unmount } = render(<DeleteSessionConfirm session={branchSession} onClose={vi.fn()} />);
    const branchWarning = screen.getByText(/This cannot be undone\./).textContent;
    unmount();

    state.workspaces = [{ id: 'workspace-1', kind: 'simple' }];
    state.sessionBranches = {};
    const branchlessSession = { id: 'session-1', workspaceId: 'workspace-1', goal: 'A' } as never;
    render(<DeleteSessionConfirm session={branchlessSession} onClose={vi.fn()} />);
    const branchlessWarning = screen.getByText(/This cannot be undone\./).textContent;

    expect(branchWarning).not.toBe(branchlessWarning);
  });
});
