import { taskPriorityOf } from './taskPriorityOf';
import type { InboxRecord } from './types';

type Params = {
  readonly record: InboxRecord;
};

export const taskHasStatus = ({ record }: Params): boolean => record.provider !== 'slack';

export const taskRowLabelOf = ({ record }: Params): string => {
  const priority = taskPriorityOf({ record });
  return [
    `${record.identifier} ${record.title}`,
    taskHasStatus({ record }) ? record.stateLabel : null,
    priority === null ? null : `${priority.label} priority`,
  ]
    .filter((part): part is string => part !== null && part !== '')
    .join(', ');
};
