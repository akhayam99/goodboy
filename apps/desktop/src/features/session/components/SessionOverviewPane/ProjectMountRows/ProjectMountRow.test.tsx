// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Project, SessionId, SessionProjectMount } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    setSessionActiveProject: vi.fn(async () => undefined),
    setScriptsLensScope: vi.fn(),
    openMountDiff: vi.fn(async () => undefined),
    projects: [] as ReadonlyArray<{ id: string; baseBranch?: string | null }>,
    emitNotification: vi.fn(),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));
vi.mock('./ProjectBranchChip', () => ({
  ProjectBranchChip: () => <span data-testid="branch-chip" />,
}));
vi.mock('./ProjectSyncControl', () => ({
  ProjectSyncControl: () => <span data-testid="sync-control" />,
}));
vi.mock('./ProjectDetachMenu', () => ({
  ProjectDetachMenu: () => <span data-testid="detach-menu" />,
}));

import { ProjectMountRow } from './ProjectMountRow';

const sessionId = 'session-1' as SessionId;

const project = {
  id: 'api',
  name: 'API',
  kind: 'repo',
} as Project;

const mount = {
  projectId: 'api',
  mountName: 'API',
  branch: 'feat/api',
  worktreePath: '/api',
  repoRoot: '/repo/api',
} as SessionProjectMount;

const renderRow = ({
  diffStat = null,
  pullRequest = null,
}: {
  readonly diffStat?: { additions: number; deletions: number } | null;
  readonly pullRequest?: { number: number; state: 'open'; isDraft: boolean } | null;
}) =>
  render(
    <ProjectMountRow
      sessionId={sessionId}
      project={project}
      mount={mount}
      diffStat={diffStat}
      pullRequest={pullRequest as never}
      worktreeStatus={null}
      onSelectLens={vi.fn()}
    />,
  );

beforeEach(() => {
  store.setSessionActiveProject.mockClear();
  store.setSessionActiveProject.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('ProjectMountRow create pr action', () => {
  it('offers create pr when there are changes and no pr, targeting the mount project', async () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-github-session', listener);
    renderRow({ diffStat: { additions: 3, deletions: 1 } });

    const action = screen.getByRole('button', { name: 'Create a PR for API' });
    fireEvent.click(action);

    await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    expect(store.setSessionActiveProject).toHaveBeenCalledWith({ sessionId, projectId: 'api' });
    window.removeEventListener('goodboy:open-github-session', listener);
  });

  it('hides create pr without changes', () => {
    renderRow({ diffStat: null });
    expect(screen.queryByRole('button', { name: 'Create a PR for API' })).toBeNull();
  });

  it('hides create pr when a pr already exists', () => {
    renderRow({
      diffStat: { additions: 3, deletions: 1 },
      pullRequest: { number: 12, state: 'open', isDraft: false },
    });
    expect(screen.queryByRole('button', { name: 'Create a PR for API' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open PR #12' })).toBeDefined();
  });
});
