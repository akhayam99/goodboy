import type { SessionEvent } from '@goodboy/types';

export const HISTORY_BATCH_WINDOW_MS = 2 * 60 * 1_000;

export type HistoryBatchOrigin = 'rebase' | 'plan';

export type HistoryBatchBranch = {
  readonly key: string;
  readonly mountId: string | null;
  readonly projectName: string | null;
  readonly branch: string | null;
  readonly isRewritten: boolean;
  readonly isPushed: boolean;
  readonly prNumber: number | null;
  readonly at: string;
};

export type HistoryBatch = {
  readonly key: string;
  readonly origin: HistoryBatchOrigin;
  readonly entryId: string;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly branches: ReadonlyArray<HistoryBatchBranch>;
};

type EventsParams = {
  readonly events: ReadonlyArray<SessionEvent>;
};

type EventParams = {
  readonly event: SessionEvent;
};

const historyEntryIdOf = ({ event }: EventParams): string => `event:${event.id}`;

const originOf = ({ event }: EventParams): HistoryBatchOrigin | null => {
  if (event.kind !== 'history_rewritten' && event.kind !== 'history_pushed') {
    return null;
  }
  const origin = event.payload?.origin;
  return origin === 'rebase' || origin === 'plan' ? origin : null;
};

export const historyBranchKeyOf = ({ event }: EventParams): string =>
  event.payload?.mountId ?? event.payload?.branch ?? event.id;

const compareEvents = (first: SessionEvent, second: SessionEvent): number =>
  first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id);

export const historyBatchBranchesOf = ({
  events,
}: EventsParams): ReadonlyArray<HistoryBatchBranch> => {
  const byKey = new Map<string, HistoryBatchBranch>();
  for (const event of events) {
    const key = historyBranchKeyOf({ event });
    const current = byKey.get(key);
    const payload = event.payload;
    const isPush = event.kind === 'history_pushed';
    byKey.set(key, {
      key,
      mountId: current?.mountId ?? payload?.mountId ?? null,
      projectName: current?.projectName ?? payload?.projectName ?? null,
      branch: current?.branch ?? payload?.branch ?? null,
      isRewritten: current?.isRewritten === true || !isPush,
      isPushed: current?.isPushed === true || isPush,
      prNumber: isPush
        ? (payload?.prNumber ?? current?.prNumber ?? null)
        : (current?.prNumber ?? null),
      at: event.createdAt,
    });
  }
  return Array.from(byKey.values());
};

type MakeParams = {
  readonly key: string;
  readonly origin: HistoryBatchOrigin;
  readonly events: ReadonlyArray<SessionEvent>;
};

const makeBatch = ({ key, origin, events }: MakeParams): HistoryBatch | null => {
  const branches = historyBatchBranchesOf({ events });
  const newest = events[events.length - 1];
  if (branches.length < 2 || newest === undefined) {
    return null;
  }
  return { key, origin, entryId: historyEntryIdOf({ event: newest }), events, branches };
};

type ClusterParams = {
  readonly origin: HistoryBatchOrigin;
  readonly events: ReadonlyArray<SessionEvent>;
};

const clustersOf = ({ origin, events }: ClusterParams): ReadonlyArray<HistoryBatch> => {
  const clusters: Array<Array<SessionEvent>> = [];
  let previousAt = Number.NEGATIVE_INFINITY;
  for (const event of events) {
    const at = Date.parse(event.createdAt);
    const last = clusters[clusters.length - 1];
    const gap = at - previousAt;
    previousAt = at;
    if (last === undefined || gap > HISTORY_BATCH_WINDOW_MS) {
      clusters.push([event]);
      continue;
    }
    last.push(event);
  }
  return clusters.flatMap((cluster) => {
    const first = cluster[0];
    const batch =
      first === undefined
        ? null
        : makeBatch({ key: `window:${origin}:${first.id}`, origin, events: cluster });
    return batch === null ? [] : [batch];
  });
};

const historyBatchesOf = ({ events }: EventsParams): ReadonlyArray<HistoryBatch> => {
  const sorted = events
    .filter((event) => originOf({ event }) !== null)
    .sort((first, second) => compareEvents(first, second));
  const keyed = new Map<string, Array<SessionEvent>>();
  const loose: Record<HistoryBatchOrigin, Array<SessionEvent>> = { rebase: [], plan: [] };
  for (const event of sorted) {
    const origin = originOf({ event });
    if (origin === null) {
      continue;
    }
    const batchId = event.payload?.batchId;
    if (batchId === undefined) {
      loose[origin].push(event);
      continue;
    }
    const key = `${origin}:${batchId}`;
    keyed.set(key, [...(keyed.get(key) ?? []), event]);
  }
  const fromKeys = Array.from(keyed.entries()).flatMap(([key, group]) => {
    const first = group[0];
    const origin = first === undefined ? null : originOf({ event: first });
    const batch = origin === null ? null : makeBatch({ key, origin, events: group });
    return batch === null ? [] : [batch];
  });
  return [
    ...fromKeys,
    ...clustersOf({ origin: 'rebase', events: loose.rebase }),
    ...clustersOf({ origin: 'plan', events: loose.plan }),
  ];
};

export const historyBatchByEventIdOf = ({
  events,
}: EventsParams): ReadonlyMap<string, HistoryBatch> => {
  const index = new Map<string, HistoryBatch>();
  for (const batch of historyBatchesOf({ events })) {
    for (const event of batch.events) {
      index.set(event.id, batch);
    }
  }
  return index;
};
