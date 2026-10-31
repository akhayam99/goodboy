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

const groupKeyOf = ({ row }: StateParams): SpawnedStateKey =>
  row.level === 1 && row.node === 'queued' ? 'done' : STATE_BY_NODE[row.node];

export const spawnedStateGroupsOf = ({ rows }: Params): ReadonlyArray<SpawnedStateGroup> => {
  const newestFirst = [...rows].reverse();
  return KEYS.map((key) => ({
    key,
    label: LABEL_BY_KEY[key],
    rows: newestFirst.filter((row) => groupKeyOf({ row }) === key),
  })).filter((group) => group.rows.length > 0);
};
