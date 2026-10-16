import { LinearPriority } from '../../../integrations/linear/LinearPriority';
import type { LinearIssue } from '../../../integrations/linear/client';
import type { InboxRecord } from '../../types';

type Props = {
  readonly record: InboxRecord;
};

export const TaskPriorityMark = ({ record }: Props) => {
  if (record.payload.provider !== 'linear') {
    return null;
  }
  const issue: LinearIssue | undefined = record.payload.issue;
  const priority = issue?.priority ?? null;
  if (priority === null || priority === 0) {
    return null;
  }
  return (
    <LinearPriority priority={priority} priorityLabel={issue?.priorityLabel} appearance="dot" />
  );
};
