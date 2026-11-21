import type { GhRunner } from '@goodboy/core/github';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { tauriGhRunner } from './github';

type Params = {
  readonly runId: string;
  readonly cwd: string;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
  readonly runner?: GhRunner;
};

export const rerunFailedJobs = async ({
  runId,
  cwd,
  workspaceId,
  projectId,
  runner = tauriGhRunner,
}: Params): Promise<void> => {
  const result = await runner.run(['run', 'rerun', runId, '--failed'], {
    cwd,
    workspaceId,
    projectId,
  });
  if (result.exitCode !== 0) {
    const said = result.stderr.trim();
    throw new Error(said === '' ? `gh run rerun exited ${result.exitCode}` : said);
  }
};
