import type { SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { jiraConfigOf } from './jiraConfigOf';
import { readJiraMove } from './readJiraMove';
import { readLinearMove } from './readLinearMove';
import type { GetFn, TrackerRead } from './types';

type Params = {
  readonly get: GetFn;
  readonly task: SessionExternalTask;
  readonly workspaceId: WorkspaceId;
};

export const readTrackerMove = async ({ get, task, workspaceId }: Params): Promise<TrackerRead> => {
  const projectId = task.projectId ?? null;
  if (task.provider === 'linear') {
    return readLinearMove({ task, workspaceId, projectId });
  }
  if (task.provider === 'jira') {
    const config = jiraConfigOf({ get, workspaceId });
    return config === null
      ? { kind: 'unknown' }
      : readJiraMove({ task, workspaceId, projectId, config });
  }
  return { kind: 'unknown' };
};
