// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorktreeStatus } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    setSessionActiveProject: vi.fn(async () => undefined),
    emitNotification: vi.fn(),
    updateProjectBaseBranch: vi.fn(async () => undefined),
    projects: [] as ReadonlyArray<{ id: string; rootPath: string; baseBranch?: string | null }>,
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));
vi.mock('../../../hooks/useRebaseAgent', () => ({
  useRebaseAgent: () => ({ canRebase: false, isRunning: false, error: null, run: vi.fn() }),
}));
vi.mock('../../../hooks/usePushBranch', () => ({
  usePushBranch: () => ({ isBusy: false, error: null, run: vi.fn() }),
}));
vi.mock('../../../../worktree/worktree', () => ({
  listBranchNames: vi.fn(async () => ['main', 'develop', 'release']),
}));

import { ProjectSyncControl } from './ProjectSyncControl';

const makeStatus = ({ behind }: { readonly behind: number }): WorktreeStatus => ({
  branch: 'feature',
  head: 'abc123',
  headSubject: 'Feature',
  mainDistance: { kind: 'known', ahead: 1, behind },
  upstreamDistance: { kind: 'known', ahead: 1, behind: 0 },
  workingTree: {
    kind: 'known',
    staged: 0,
    unstaged: 0,
    untracked: 0,
    unmerged: 0,
    changed: 0,
  },
  upstream: 'origin/feature',
  inProgress: null,
});

const renderControl = ({ status }: { readonly status: WorktreeStatus | null }) =>
  render(
    <ProjectSyncControl
      sessionId={'session-1' as never}
      projectId={'project-1' as never}
      status={status}
    />,
  );

describe('ProjectSyncControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.projects = [{ id: 'project-1', rootPath: '/repo', baseBranch: 'develop' }];
  });
  afterEach(cleanup);

  it('shows the behind badge only when behind is greater than zero', async () => {
    const behindStatus = makeStatus({ behind: 2 });
    const view = renderControl({ status: behindStatus });
    expect(screen.getByTestId('project-behind-badge').textContent).toBe('2');

    view.unmount();
    renderControl({ status: makeStatus({ behind: 0 }) });
    expect(screen.queryByTestId('project-behind-badge')).toBeNull();
  });

  it('shows placeholders and no badge before status is known', () => {
    renderControl({ status: null });

    expect(screen.queryByTestId('project-behind-badge')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Branch sync actions' }));
    expect(screen.getAllByText('--')).toHaveLength(2);
  });

  it('commits a trimmed base branch on Enter', async () => {
    renderControl({ status: null });
    fireEvent.click(screen.getByRole('button', { name: 'Branch sync actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Base branch: develop' }));
    const input = screen.getByRole('combobox', { name: 'Base branch' });
    fireEvent.change(input, { target: { value: '  release  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(store.updateProjectBaseBranch).toHaveBeenCalledWith({
        projectId: 'project-1',
        baseBranch: 'release',
      }),
    );
  });

  it('clears an empty base branch to null', async () => {
    renderControl({ status: null });
    fireEvent.click(screen.getByRole('button', { name: 'Branch sync actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Base branch: develop' }));
    const input = screen.getByRole('combobox', { name: 'Base branch' });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(store.updateProjectBaseBranch).toHaveBeenCalledWith({
        projectId: 'project-1',
        baseBranch: null,
      }),
    );
  });

  it('reverts the base branch edit on Escape', () => {
    renderControl({ status: null });
    fireEvent.click(screen.getByRole('button', { name: 'Branch sync actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Base branch: develop' }));
    const input = screen.getByRole('combobox', { name: 'Base branch' });
    fireEvent.change(input, { target: { value: 'release' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(store.updateProjectBaseBranch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Branch sync actions' }));
    expect(screen.getByRole('button', { name: 'Base branch: develop' })).toBeDefined();
  });
});
