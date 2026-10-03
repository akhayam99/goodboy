// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MountId, Project, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { emptyOverrides } from '../../../../../store/storyHarness';

const SID = 'session-1' as SessionId;
const WID = 'workspace-1' as WorkspaceId;
const PID = 'project-1' as ProjectId;
const MID = 'mount-1' as MountId;

const repoProject = {
  id: PID,
  workspaceId: WID,
  name: 'goodboy',
  kind: 'repo',
  rootPath: '/repos/goodboy',
  baseBranch: 'main',
  overrides: emptyOverrides,
  createdAt: '2026-07-27T00:00:00.000Z',
  updatedAt: '2026-07-27T00:00:00.000Z',
} as unknown as Project;

const h = vi.hoisted(() => ({
  ensureProjectMounted: vi.fn(async () => undefined),
  emitNotification: vi.fn(),
  preflight: {
    status: 'ready' as 'ready' | 'checking',
    preflight: {
      mountId: 'mount-1',
      slug: 'ship-it',
      branch: 'ak/ship-it',
      baseBranch: 'main',
      targetPath: '/repos/goodboy/.goodboy/worktrees/ship-it-mount-1',
      renamedFrom: null as string | null,
    },
    branchScanError: null as string | null,
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(
    selector: (state: {
      readonly ensureProjectMounted: typeof h.ensureProjectMounted;
      readonly emitNotification: typeof h.emitNotification;
    }) => T,
  ) =>
    selector({
      ensureProjectMounted: h.ensureProjectMounted,
      emitNotification: h.emitNotification,
    }),
}));

vi.mock('./useMountPreflight', () => ({ useMountPreflight: () => h.preflight }));

import { MountProjectList } from './MountProjectList';

const renderList = () =>
  render(<MountProjectList sessionId={SID} projects={[repoProject]} onDone={vi.fn()} />);

beforeEach(() => {
  vi.clearAllMocks();
  h.preflight.preflight.renamedFrom = null;
  h.preflight.branchScanError = null;
  h.preflight.status = 'ready';
  h.ensureProjectMounted.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('MountProjectList', () => {
  it('shows base, branch and target path before creating anything', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Add goodboy' }));

    expect(h.ensureProjectMounted).not.toHaveBeenCalled();
    screen.getByText('main');
    screen.getByText('ak/ship-it');
    screen.getByText('/repos/goodboy/.goodboy/worktrees/ship-it-mount-1');
  });

  it('creates with exactly the branch and the mount the preview showed', async () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Add goodboy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }));

    await waitFor(() =>
      expect(h.ensureProjectMounted).toHaveBeenCalledWith({
        sessionId: SID,
        projectId: PID,
        reason: 'added manually by the user',
        mountId: MID,
        slug: 'ship-it',
      }),
    );
  });

  it('names the branch it had to step around', () => {
    h.preflight.preflight.renamedFrom = 'ak/taken';
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Add goodboy' }));

    expect(screen.getByRole('status').textContent).toContain('ak/taken already exists');
  });

  it('goes back to the list without creating anything', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Add goodboy' }));
    const back = screen.getByRole('button', { name: 'Back' });
    expect(back.closest('[data-slot="form-actions"]')).not.toBeNull();
    expect(back.parentElement).toBe(
      screen.getByRole('button', { name: 'Add project' }).parentElement,
    );
    fireEvent.click(back);

    screen.getByRole('button', { name: 'Add goodboy' });
    expect(h.ensureProjectMounted).not.toHaveBeenCalled();
  });
  it('names what is running while the branches are read and while it creates', async () => {
    h.preflight.status = 'checking';
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Add goodboy' }));

    screen.getByText('Reading the branches already in the repository…');

    h.preflight.status = 'ready';
    const deferred: { resolve: () => void } = { resolve: () => undefined };
    h.ensureProjectMounted.mockReturnValueOnce(
      new Promise<undefined>((resolve) => {
        deferred.resolve = () => resolve(undefined);
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }));

    await waitFor(() => screen.getByText('Creating the worktree…'));
    deferred.resolve();
  });

  it('shows the cause, the technical detail and a retry after a failure', async () => {
    h.ensureProjectMounted.mockRejectedValueOnce(
      new Error('cannot find base ref: tried origin/main'),
    );
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Add goodboy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('cannot find base ref: tried origin/main');
    screen.getByText('Technical detail');
    expect(alert.parentElement?.textContent).toContain('path: /repos/goodboy');

    const retry = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(retry);
    await waitFor(() => expect(h.ensureProjectMounted).toHaveBeenCalledTimes(2));
  });
});
