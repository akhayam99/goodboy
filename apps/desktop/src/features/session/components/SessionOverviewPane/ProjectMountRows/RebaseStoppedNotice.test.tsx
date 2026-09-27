// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, SessionId, WorktreeStatus } from '@goodboy/types';

const { state, worktreeAbortRebase, ensure, rebase } = vi.hoisted(() => ({
  state: { reportError: vi.fn(async () => undefined) },
  worktreeAbortRebase: vi.fn(async () => undefined),
  ensure: vi.fn(async () => null),
  rebase: {
    canRebase: false,
    canResume: true,
    isRunning: false,
    error: null,
    run: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <Value,>(selector: (store: typeof state) => Value) => selector(state),
}));
vi.mock('../../../../worktree/worktree', () => ({ worktreeAbortRebase }));
vi.mock('../../../hooks/useRebaseAgent', () => ({ useRebaseAgent: () => rebase }));
vi.mock('../../../hooks/useWorktreeStatuses/cache', () => ({
  ensure,
  worktreeStatusKey: () => 'key',
}));

import { RebaseStoppedNotice } from './RebaseStoppedNotice';

type TypedStringParams = {
  readonly value: string;
};

const typedString = <Value extends string>({ value }: TypedStringParams): Value =>
  JSON.parse(JSON.stringify(value));

const statusOf = (overrides: Partial<WorktreeStatus> = {}): WorktreeStatus => ({
  branch: 'feature/x',
  head: 'abc123',
  headSubject: 'base',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  mainDistance: { kind: 'known', ahead: 1, behind: 2 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 2, changed: 2 },
  upstream: 'origin/feature/x',
  inProgress: 'rebase',
  ...overrides,
});

const onOpenTerminal = vi.fn();

const renderNotice = (status: WorktreeStatus | null) =>
  render(
    <RebaseStoppedNotice
      sessionId={typedString<SessionId>({ value: 'session-1' })}
      mountId={typedString<MountId>({ value: 'mount-1' })}
      worktreePath="/worktrees/api"
      baseBranch="main"
      status={status}
      onOpenTerminal={onOpenTerminal}
    />,
  );

beforeEach(() => {
  rebase.isRunning = false;
  worktreeAbortRebase.mockClear();
  rebase.resume.mockClear();
  onOpenTerminal.mockClear();
});

afterEach(cleanup);

describe('RebaseStoppedNotice', () => {
  it('names the stopped rebase and its conflicts', () => {
    renderNotice(statusOf());

    expect(screen.getByText('Rebase stopped')).toBeDefined();
    expect(
      screen.getByText('A rebase stopped halfway in this worktree, 2 files have conflicts.'),
    ).toBeDefined();
  });

  it('stays away when no rebase stopped or an agent already works on it', () => {
    const { container } = renderNotice(statusOf({ inProgress: null }));
    expect(container.innerHTML).toBe('');
    cleanup();

    rebase.isRunning = true;
    const running = renderNotice(statusOf());
    expect(running.container.innerHTML).toBe('');
  });

  it('hands the rebase to an agent on this mount', () => {
    renderNotice(statusOf());

    fireEvent.click(screen.getByRole('button', { name: 'Hand it to an agent' }));

    expect(rebase.resume).toHaveBeenCalledWith({ mountId: 'mount-1' });
  });

  it('opens a terminal in the worktree', () => {
    renderNotice(statusOf());

    fireEvent.click(screen.getByRole('button', { name: 'Open terminal' }));

    expect(onOpenTerminal).toHaveBeenCalled();
  });

  it('aborts only after the inline confirmation', async () => {
    renderNotice(statusOf());

    fireEvent.click(screen.getByRole('button', { name: 'Abort rebase' }));
    expect(worktreeAbortRebase).not.toHaveBeenCalled();
    expect(screen.getByText('Abort the rebase?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Abort rebase' }));

    await waitFor(() =>
      expect(worktreeAbortRebase).toHaveBeenCalledWith({ worktreePath: '/worktrees/api' }),
    );
    await waitFor(() =>
      expect(ensure).toHaveBeenCalledWith(expect.objectContaining({ maxAgeMs: 0 })),
    );
  });
});
