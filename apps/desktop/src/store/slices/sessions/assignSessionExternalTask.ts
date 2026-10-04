import type { ProjectId, SessionExternalTask, SessionId } from '@goodboy/types';
import { removeSessionExternalTask } from './removeSessionExternalTask';
import { writeSessionExternalTask } from './writeSessionExternalTask';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type AssignParams = {
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
  readonly branch: string;
  readonly projectId?: ProjectId;
};

export const assignSessionExternalTask = ({ set, get }: Params) => {
  const write = writeSessionExternalTask({ set, get });
  const remove = removeSessionExternalTask({ set, get });
  return async ({ sessionId, task, branch, projectId }: AssignParams): Promise<void> => {
    if (branch === '') {
      throw new Error('Pick a branch to put this task on.');
    }
    const target = projectId ?? task.projectId;
    await write({
      sessionId,
      task: {
        ...task,
        ...(target !== undefined ? { projectId: target } : {}),
        scope: 'branch',
        branch,
        relation: task.relation ?? 'closes',
      },
    });
    if (task.scope === 'branch') {
      return;
    }
    await remove({
      sessionId,
      provider: task.provider,
      externalId: task.externalId,
      projectId: task.projectId,
    });
  };
};
