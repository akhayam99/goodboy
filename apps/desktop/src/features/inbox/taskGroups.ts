import { integrationLabel } from '../integrations/components/IntegrationGlyph';
import { orderInboxRecords } from './orderInboxRecords';
import type { InboxRecord, InboxState } from './types';

export type TaskGroupBy = 'source' | 'status' | 'project' | 'none';

export const TASK_GROUP_BYS: ReadonlyArray<TaskGroupBy> = ['source', 'status', 'project', 'none'];

export const TASK_GROUP_BY_LABEL = {
  source: 'Source',
  status: 'Status',
  project: 'Project',
  none: 'None',
} satisfies Record<TaskGroupBy, string>;

export type TaskGroup = {
  readonly key: string;
  readonly label: string;
  readonly records: ReadonlyArray<InboxRecord>;
};

type Params = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly groupBy: TaskGroupBy;
  readonly projectNames: Readonly<Record<string, string>>;
};

type Bucket = {
  readonly key: string;
  readonly label: string;
  readonly rank: number;
};

const STATE_RANK = {
  alert: 0,
  active: 1,
  open: 2,
  done: 3,
} satisfies Record<InboxState, number>;

const NO_PROJECT_KEY = 'project:none';

type BucketParams = {
  readonly record: InboxRecord;
  readonly groupBy: TaskGroupBy;
  readonly projectNames: Readonly<Record<string, string>>;
};

const bucketOf = ({ record, groupBy, projectNames }: BucketParams): Bucket => {
  switch (groupBy) {
    case 'source':
      return {
        key: `source:${record.provider}`,
        label: integrationLabel({ provider: record.provider }),
        rank: 0,
      };
    case 'status':
      return {
        key: `status:${record.provider}:${record.stateLabel}`,
        label: `${integrationLabel({ provider: record.provider })} · ${record.stateLabel}`,
        rank: STATE_RANK[record.state],
      };
    case 'project': {
      const projectId = (record.projectIds ?? []).find((id) => projectNames[id] !== undefined);
      if (projectId === undefined) {
        return { key: NO_PROJECT_KEY, label: 'No project', rank: 1 };
      }
      return { key: `project:${projectId}`, label: projectNames[projectId] ?? '', rank: 0 };
    }
    case 'none':
      return { key: 'none', label: 'All tasks', rank: 0 };
    default: {
      const exhaustive: never = groupBy;
      return exhaustive;
    }
  }
};

export const taskGroupsOf = ({
  records,
  groupBy,
  projectNames,
}: Params): ReadonlyArray<TaskGroup> => {
  const buckets = new Map<string, { readonly bucket: Bucket; readonly records: InboxRecord[] }>();
  for (const record of records) {
    const bucket = bucketOf({ record, groupBy, projectNames });
    const entry = buckets.get(bucket.key);
    if (entry === undefined) {
      buckets.set(bucket.key, { bucket, records: [record] });
      continue;
    }
    entry.records.push(record);
  }
  return [...buckets.values()]
    .sort(
      (left, right) =>
        left.bucket.rank - right.bucket.rank ||
        right.records.length - left.records.length ||
        left.bucket.label.localeCompare(right.bucket.label),
    )
    .map((entry) => ({
      key: entry.bucket.key,
      label: entry.bucket.label,
      records: orderInboxRecords({ records: entry.records }),
    }));
};
