import { taskGroupsOf, type TaskGroupBy } from './taskGroups';
import type { InboxRecord } from './types';

type Params = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly groupBy: TaskGroupBy;
  readonly projectNames: Readonly<Record<string, string>>;
};

export const taskGroupTotalsOf = ({
  records,
  groupBy,
  projectNames,
}: Params): ReadonlyMap<string, number> =>
  new Map(
    taskGroupsOf({ records, groupBy, projectNames }).map(
      (group) => [group.key, group.records.length] as const,
    ),
  );
