import type { ProjectId, SessionExternalTask, SessionId } from '@goodboy/types';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
};

type AssignParams = {
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
  readonly branch: string;
  readonly projectId?: ProjectId;
};

export const assignSessionExternalTask = ({ get }: Params) => {
  return async ({ sessionId, task, branch, projectId }: AssignParams): Promise<void> => {
    if (branch === '') {
      throw new Error('Pick a branch to put this task on.');
    }
    const target = projectId ?? task.projectId;
    await get().linkSessionExternalTask(sessionId, {
      ...task,
      ...(target !== undefined ? { projectId: target } : {}),
      scope: 'branch',
      branch,
      relation: task.relation ?? 'closes',
    });
    if (task.scope === 'branch') {
      return;
    }
    await get().unlinkSessionExternalTask(
      sessionId,
      task.provider,
      task.externalId,
      task.projectId,
    );
  };
};
