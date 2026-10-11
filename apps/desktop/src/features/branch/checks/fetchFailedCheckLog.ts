import type { GhRunner } from '@goodboy/core';
import type { PrCheckRun, ProjectId, WorkspaceId } from '@goodboy/types';
import { tauriGhRunner } from '../../integrations/github/github';
import { failedLogTail } from './failedLogTail';

type Params = {
  readonly check: PrCheckRun;
  readonly cwd: string;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
  readonly runner?: GhRunner;
};

export const fetchFailedCheckLog = async ({
  check,
  cwd,
  workspaceId,
  projectId,
  runner = tauriGhRunner,
}: Params): Promise<string | null> => {
  const match = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/actions\/runs\/(\d+)\/job\/(\d+)$/.exec(
    check.detailsUrl ?? '',
  );
  if (match === null || match[1] === undefined || match[2] === undefined) {
    return null;
  }
  try {
    const result = await runner.run(['run', 'view', match[1], '--job', match[2], '--log-failed'], {
      cwd,
      workspaceId,
      projectId,
    });
    if (result.exitCode !== 0) {
      return null;
    }
    return failedLogTail({ text: result.stdout }).text;
  } catch {
    return null;
  }
};
