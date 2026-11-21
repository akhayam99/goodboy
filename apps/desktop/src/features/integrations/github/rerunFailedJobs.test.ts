// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '@goodboy/core/github';
import { brandId, type ProjectId, type WorkspaceId } from '@goodboy/types';
import { rerunFailedJobs } from './rerunFailedJobs';

const workspaceId = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const projectId = brandId<ProjectId>({ value: 'project-ledger-core' });

const runnerOf = ({ exitCode, stderr }: { readonly exitCode: number; readonly stderr: string }) => {
  const run = vi.fn(async (_args: ReadonlyArray<string>, _options?: unknown) => ({
    stdout: '',
    stderr,
    exitCode,
  }));
  const runner: GhRunner = { run };
  return { run, runner };
};

describe('rerunFailedJobs', () => {
  it('asks gh for the failed jobs of one run and nothing wider', async () => {
    const { run, runner } = runnerOf({ exitCode: 0, stderr: '' });
    await rerunFailedJobs({
      runId: '9001',
      cwd: '/work/ledger-core',
      workspaceId,
      projectId,
      runner,
    });
    expect(run).toHaveBeenCalledWith(['run', 'rerun', '9001', '--failed'], {
      cwd: '/work/ledger-core',
      workspaceId,
      projectId,
    });
  });

  it('throws what gh said when it fails', async () => {
    const { runner } = runnerOf({ exitCode: 1, stderr: 'run 9001 is still in progress\n' });
    await expect(
      rerunFailedJobs({ runId: '9001', cwd: '/work/ledger-core', workspaceId, projectId, runner }),
    ).rejects.toThrow('run 9001 is still in progress');
  });

  it('names the exit code when gh said nothing', async () => {
    const { runner } = runnerOf({ exitCode: 4, stderr: '' });
    await expect(
      rerunFailedJobs({ runId: '9001', cwd: '/work/ledger-core', workspaceId, projectId, runner }),
    ).rejects.toThrow('gh run rerun exited 4');
  });
});
