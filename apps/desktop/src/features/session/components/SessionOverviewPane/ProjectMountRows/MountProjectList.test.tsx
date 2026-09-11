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
  materializeProject: vi.fn(async () => undefined),
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
      readonly materializeProject: typeof h.materializeProject;
      readonly emitNotification: typeof h.emitNotification;
    }) => T,
  ) =>
    selector({
      materializeProject: h.materializeProject,
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
  h.materializeProject.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('MountProjectList', () => {
  it('shows base, branch and target path before creating anything', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Mount goodboy' }));

    expect(h.materializeProject).not.toHaveBeenCalled();
    expect(screen.getByText('main')).toBeTruthy();
    expect(screen.getByText('ak/ship-it')).toBeTruthy();
    expect(screen.getByText('/repos/goodboy/.goodboy/worktrees/ship-it-mount-1')).toBeTruthy();
  });

  it('creates with exactly the branch and the mount the preview showed', async () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Mount goodboy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }));

    await waitFor(() =>
      expect(h.materializeProject).toHaveBeenCalledWith({
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
    fireEvent.click(screen.getByRole('button', { name: 'Mount goodboy' }));

    expect(screen.getByRole('status').textContent).toContain('ak/taken already exists');
  });

  it('goes back to the list without creating anything', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Mount goodboy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('button', { name: 'Mount goodboy' })).toBeTruthy();
    expect(h.materializeProject).not.toHaveBeenCalled();
  });
  it('names what is running while the branches are read and while it creates', async () => {
    h.preflight.status = 'checking';
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Mount goodboy' }));

    expect(screen.getByText('Reading the branches already in the repository…')).toBeTruthy();

    h.preflight.status = 'ready';
    const deferred: { resolve: () => void } = { resolve: () => undefined };
    h.materializeProject.mockReturnValueOnce(
      new Promise<undefined>((resolve) => {
        deferred.resolve = () => resolve(undefined);
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }));

    await waitFor(() => expect(screen.getByText('Creating the worktree…')).toBeTruthy());
    deferred.resolve();
  });

  it('shows the cause, the technical detail and a retry after a failure', async () => {
    h.materializeProject.mockRejectedValueOnce(
      new Error('cannot find base ref: tried origin/main'),
    );
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Mount goodboy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('cannot find base ref: tried origin/main');
    expect(screen.getByText('Technical detail')).toBeTruthy();
    expect(alert.parentElement?.textContent).toContain('path: /repos/goodboy');

    const retry = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(retry);
    await waitFor(() => expect(h.materializeProject).toHaveBeenCalledTimes(2));
  });
});
