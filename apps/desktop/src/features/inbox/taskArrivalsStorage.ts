import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES, persistedPref } from '../../shared/lib/storage-keys';
import { EMPTY_TASK_ARRIVALS, type TaskArrivals } from './taskArrivals';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = Params & {
  readonly arrivals: TaskArrivals;
};

type StampEntry = readonly [string, number];

type EntryParams = {
  readonly entry: unknown;
};

const stampOf = ({ entry }: EntryParams): StampEntry | null => {
  if (!Array.isArray(entry) || entry.length !== 2) {
    return null;
  }
  const key: unknown = entry[0];
  const at: unknown = entry[1];
  return typeof key === 'string' && typeof at === 'number' && Number.isFinite(at)
    ? [key, at]
    : null;
};

type StoredParams = {
  readonly stored: unknown;
};

const arrivalsOf = ({ stored }: StoredParams): TaskArrivals => {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    return EMPTY_TASK_ARRIVALS;
  }
  const seenAt: unknown = Reflect.get(stored, 'seenAt');
  const firstSeen: unknown = Reflect.get(stored, 'firstSeen');
  if (
    !(seenAt === null || (typeof seenAt === 'number' && Number.isFinite(seenAt))) ||
    !Array.isArray(firstSeen)
  ) {
    return EMPTY_TASK_ARRIVALS;
  }
  const entries: ReadonlyArray<unknown> = firstSeen;
  const stamps = entries
    .map((entry) => stampOf({ entry }))
    .filter((stamp): stamp is StampEntry => stamp !== null);
  return { seenAt, firstSeen: new Map(stamps) };
};

const taskArrivalsPref = ({ workspaceId }: Params) =>
  persistedPref<unknown>({
    key: `${STORAGE_PREFIXES.taskArrivals}${workspaceId}`,
    fallback: null,
    parse: JSON.parse,
  });

export const readTaskArrivals = ({ workspaceId }: Params): TaskArrivals =>
  arrivalsOf({ stored: taskArrivalsPref({ workspaceId }).read() });

export const writeTaskArrivals = ({ workspaceId, arrivals }: WriteParams): void =>
  taskArrivalsPref({ workspaceId }).write({
    seenAt: arrivals.seenAt,
    firstSeen: [...arrivals.firstSeen],
  });
