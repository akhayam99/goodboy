import type { ProjectId, SessionExternalTask, SessionId } from '@goodboy/types';
import { moveSessionExternalTask } from './moveSessionExternalTask';
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
  const move = moveSessionExternalTask({ set, get });
  return async ({ sessionId, task, branch, projectId }: AssignParams): Promise<void> => {
    await move({
      sessionId,
      task,
      to: { kind: 'branch', projectId: projectId ?? task.projectId ?? null, branch },
      isCopy: task.scope === 'branch',
    });
  };
};
