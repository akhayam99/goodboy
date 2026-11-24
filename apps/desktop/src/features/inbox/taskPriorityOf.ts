import type { InboxRecord } from './types';

export type TaskPriority = {
  readonly priority: number;
  readonly label: string;
};

type Params = {
  readonly record: InboxRecord;
};

export const taskPriorityOf = ({ record }: Params): TaskPriority | null => {
  if (record.payload.provider !== 'linear') {
    return null;
  }
  const issue = record.payload.issue;
  const priority = issue.priority ?? null;
  if (priority === null || priority === 0) {
    return null;
  }
  return { priority, label: issue.priorityLabel ?? 'No priority' };
};
