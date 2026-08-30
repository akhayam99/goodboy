// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, SessionId, WorktreeStatus } from '@goodboy/types';

const { state, showToast } = vi.hoisted(() => ({
  state: {
    detachProject: vi.fn(async () => undefined),
    emitNotification: vi.fn(),
  },
  showToast: vi.fn(),
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('../../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));

import { ProjectDetachMenu } from './ProjectDetachMenu';

const typedString = <Value extends string>({ value }: { readonly value: string }): Value =>
  JSON.parse(JSON.stringify(value));

const workingTreeStatus = ({ changed }: { readonly changed: number }): WorktreeStatus => ({
  branch: 'feature',
  head: 'abc123',
  headSubject: 'Feature',
  mainDistance: { kind: 'known', ahead: 0, behind: 0 },
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: {
    kind: 'known',
    staged: 0,
    unstaged: changed,
    untracked: 0,
    unmerged: 0,
    changed,
  },
  upstream: 'origin/feature',
  inProgress: null,
});

const renderMenu = ({ status }: { readonly status: WorktreeStatus | null }) =>
  render(
    <ProjectDetachMenu
      sessionId={typedString<SessionId>({ value: 'session-1' })}
      projectId={typedString<ProjectId>({ value: 'project-1' })}
      workspaceId={undefined}
      projectName="api"
      worktreePath="/worktrees/api"
      worktreeStatus={status}
      triggerClassName="trigger"
    />,
  );

const openConfirm = () => {
  fireEvent.click(screen.getByRole('button', { name: 'api actions' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Detach project' }));
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProjectDetachMenu', () => {
  it('renders clean worktree confirmation copy', () => {
    renderMenu({ status: workingTreeStatus({ changed: 0 }) });
    openConfirm();

    expect(screen.getByText('Detach api?')).toBeDefined();
    expect(screen.getByText('Its worktree is clean and will be removed.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Detach' })).toBeDefined();
  });

  it('renders dirty worktree confirmation copy and keeps changes', () => {
    renderMenu({ status: workingTreeStatus({ changed: 2 }) });
    openConfirm();

    expect(screen.getByText('Uncommitted changes stay on disk at')).toBeDefined();
    expect(screen.getByText('/worktrees/api')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Detach, keep changes' })).toBeDefined();
  });

  it('treats unknown status as dirty', () => {
    renderMenu({ status: null });
    openConfirm();

    expect(screen.getByText('Uncommitted changes stay on disk at')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Detach, keep changes' })).toBeDefined();
  });

  it('returns to the item list on cancel', () => {
    renderMenu({ status: null });
    openConfirm();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('menuitem', { name: 'Detach project' })).toBeDefined();
  });

  it('reports the kept worktree path after a dirty detach', async () => {
    renderMenu({ status: workingTreeStatus({ changed: 2 }) });
    openConfirm();
    fireEvent.click(screen.getByRole('button', { name: 'Detach, keep changes' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('info', 'Worktree kept at /worktrees/api'),
    );
  });
});
