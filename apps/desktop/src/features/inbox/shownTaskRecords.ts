import type { InboxRecord } from './types';

export const TASK_GROUP_CAP = 5;

export const TASK_VIRTUAL_MIN = 60;

type Params = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly isExpanded: boolean;
};

export const shownTaskRecords = ({ records, isExpanded }: Params): ReadonlyArray<InboxRecord> =>
  isExpanded ? records : records.slice(0, TASK_GROUP_CAP);
