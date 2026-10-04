import type { SessionExternalTask } from '@goodboy/types';
import { taskIdentityKey } from '../../utils/taskIdentityKey';

export type DistinctTask = {
  readonly task: SessionExternalTask;
  readonly branches: ReadonlyArray<string>;
};

type Params = {
  readonly tasks: ReadonlyArray<SessionExternalTask>;
};

export const distinctTasks = ({ tasks }: Params): ReadonlyArray<DistinctTask> => {
  const groups = new Map<string, { task: SessionExternalTask; branches: Array<string> }>();
  for (const task of tasks) {
    const key = taskIdentityKey({ task });
    const group = groups.get(key) ?? { task, branches: [] };
    if (task.scope === 'branch' && task.branch !== undefined && task.branch !== '') {
      group.branches.push(task.branch);
    }
    if (task.scope !== 'branch' && group.task.scope === 'branch') {
      group.task = task;
    }
    groups.set(key, group);
  }
  return [...groups.values()];
};
