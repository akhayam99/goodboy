// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type MountId, type ProjectId, type WorkspaceId } from '@goodboy/types';

const { rerunFailedJobs } = vi.hoisted(() => ({
  rerunFailedJobs: vi.fn(async (_params: unknown) => undefined),
}));

vi.mock('../../integrations/github/rerunFailedJobs', () => ({ rerunFailedJobs }));

import { rerunCheckAction } from './rerunCheckAction';

const payload = {
  mountId: brandId<MountId>({ value: 'mount-ledger-core' }),
  prNumber: 418,
  checkName: 'integration-tests',
  runId: '9001',
  cwd: '/work/ledger-core',
};
const workspaceId = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const projectId = brandId<ProjectId>({ value: 'project-ledger-core' });

describe('rerunCheckAction', () => {
  beforeEach(() => {
    rerunFailedJobs.mockClear();
    rerunFailedJobs.mockResolvedValue(undefined);
  });

  it('reruns the failed jobs of the named run in the named worktree', async () => {
    const action = rerunCheckAction({ payload, workspaceId, projectId });
    expect(action?.label).toBe('Rerun');
    await action?.run();
    expect(rerunFailedJobs).toHaveBeenCalledWith({
      runId: '9001',
      cwd: '/work/ledger-core',
      workspaceId,
      projectId,
    });
  });

  it('fails with a title that names the check, and Retry runs it again', async () => {
    rerunFailedJobs.mockRejectedValueOnce(new Error('run 9001 cannot be rerun'));
    const action = rerunCheckAction({ payload, workspaceId, projectId });
    expect(action?.failureTitle).toBe("Couldn't rerun integration-tests");
    await expect(action?.run()).rejects.toThrow('run 9001 cannot be rerun');
    await action?.run();
    expect(rerunFailedJobs).toHaveBeenCalledTimes(2);
  });

  it('is disabled and runs nothing when the project of the mount is unknown', async () => {
    const action = rerunCheckAction({ payload, workspaceId, projectId: null });
    expect(action?.isDisabled).toBe(true);
    await action?.run();
    expect(rerunFailedJobs).not.toHaveBeenCalled();
  });
});
