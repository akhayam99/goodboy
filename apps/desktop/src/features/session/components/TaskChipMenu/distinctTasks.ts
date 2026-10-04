import type { SessionExternalTask } from '@goodboy/types';

export type DistinctTask = {
  readonly task: SessionExternalTask;
  readonly branches: ReadonlyArray<string>;
};

type Params = {
  readonly tasks: ReadonlyArray<SessionExternalTask>;
};

const identityOf = (task: SessionExternalTask): string =>
  [task.provider, task.externalId, task.projectId ?? ''].join(':');

export const distinctTasks = ({ tasks }: Params): ReadonlyArray<DistinctTask> => {
  const groups = new Map<string, { task: SessionExternalTask; branches: Array<string> }>();
  for (const task of tasks) {
    const key = identityOf(task);
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
