// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProjectId, WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import {
  buildStoryProject,
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { actionRetryOf } from '../../../../store/slices/notifications/actionRetries';
import { ProjectGitDetail } from './ProjectGitDetail';

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });

const project = buildStoryProject({
  id: brandId<ProjectId>({ value: 'project-ledger-core' }),
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/tmp/ledger-core',
});

const BEHIND: WorkspaceGitStatus = {
  state: 'ready',
  branch: 'main',
  headSubject: 'Round settlement totals',
  upstream: 'origin/main',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 2 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress: null,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ worktree_repo_default_base_branch: 'main' });
});

afterEach(cleanup);

describe('the git detail of a project', () => {
  it('links a failed base branch save to the base branch control and marks it invalid', async () => {
    useAppStore.setState({
      updateProjectBaseBranch: vi.fn(async () => {
        throw new Error('the project row is locked');
      }),
    });
    stubStoryInvoke({
      worktree_repo_default_base_branch: 'main',
      worktree_list_branch_names: ['main'],
    });
    render(<ProjectGitDetail project={project} status={BEHIND} />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Base branch' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Search branches' }), {
      target: { value: 'release' },
    });
    fireEvent.click(await screen.findByRole('option', { name: /Use release/ }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('the project row is locked');
    const control = screen.getByRole('combobox', { name: 'Base branch' });
    expect(control.getAttribute('aria-describedby')).toBe(alert.id);
    expect(control.getAttribute('aria-invalid')).toBe('true');
  });

  it('logs a failed fast-forward once with a Retry that pulls the same project, and keeps no red line', async () => {
    const fastForwardProjectCheckout = vi.fn();
    fastForwardProjectCheckout.mockRejectedValueOnce(new Error('not possible to fast-forward'));
    fastForwardProjectCheckout.mockResolvedValueOnce(undefined);
    useAppStore.setState({ fastForwardProjectCheckout });
    render(<ProjectGitDetail project={project} status={BEHIND} />);

    fireEvent.click(screen.getByRole('button', { name: 'Fast-forward main to origin/main' }));

    await vi.waitFor(() =>
      expect(useAppStore.getState().notifications[0]?.title).toBe(
        "Couldn't fast-forward ledger-core",
      ),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    const action = useAppStore.getState().notifications[0]?.action;
    const retry =
      action?.kind === 'retry-action' ? actionRetryOf({ retryId: action.retryId }) : undefined;
    expect(await retry?.()).toBe(true);
    expect(fastForwardProjectCheckout).toHaveBeenLastCalledWith({ projectId: project.id });
    expect(fastForwardProjectCheckout).toHaveBeenCalledTimes(2);
  });
});
