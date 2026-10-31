import type { WorkNodeState } from '@goodboy/ui';
import type { SpawnedRow } from './spawnedRow';

type SpawnedStateKey = 'working' | 'waiting' | 'done';

export type SpawnedStateGroup = Readonly<{
  key: SpawnedStateKey;
  label: string;
  rows: ReadonlyArray<SpawnedRow>;
}>;

type Params = {
  readonly rows: ReadonlyArray<SpawnedRow>;
};

const STATE_BY_NODE: Readonly<Record<WorkNodeState, SpawnedStateKey>> = {
  running: 'working',
  merging: 'working',
  queued: 'waiting',
  ready: 'waiting',
  question: 'waiting',
  budget: 'waiting',
  approval: 'waiting',
  alert: 'waiting',
  failed: 'waiting',
  approved: 'done',
  done: 'done',
  finished: 'done',
  closed: 'done',
  stopped: 'done',
  skipped: 'done',
  marker: 'done',
  mixed: 'done',
};

const LABEL_BY_KEY: Readonly<Record<SpawnedStateKey, string>> = {
  working: 'Working',
  waiting: 'Waiting',
  done: 'Done',
};

const KEYS: ReadonlyArray<SpawnedStateKey> = ['working', 'waiting', 'done'];

type StateParams = {
  readonly row: SpawnedRow;
};

const groupKeyOf = ({ row }: StateParams): SpawnedStateKey => STATE_BY_NODE[row.node];

const startedAtOf = ({ row }: StateParams): number | null => {
  const startedAt = row.model?.agent.startedAt;
  if (startedAt === undefined) {
    return null;
  }
  const ms = Date.parse(startedAt);
  return Number.isNaN(ms) ? null : ms;
};

const newestFirstOf = ({ rows }: Params): ReadonlyArray<SpawnedRow> => {
  const traversal = [...rows].reverse();
  const times = traversal.map((row) => startedAtOf({ row }));
  if (times.some((time) => time === null)) {
    return traversal;
  }
  const order = new Map(traversal.map((row, index) => [row, index]));
  const timeOf = new Map(traversal.map((row, index) => [row, times[index] ?? 0]));
  return [...traversal].sort((first, second) => {
    const gap = (timeOf.get(second) ?? 0) - (timeOf.get(first) ?? 0);
    return gap === 0 ? (order.get(first) ?? 0) - (order.get(second) ?? 0) : gap;
  });
};

export const spawnedStateGroupsOf = ({ rows }: Params): ReadonlyArray<SpawnedStateGroup> =>
  KEYS.map((key) => ({
    key,
    label: LABEL_BY_KEY[key],
    rows: newestFirstOf({ rows: rows.filter((row) => groupKeyOf({ row }) === key) }),
  })).filter((group) => group.rows.length > 0);
