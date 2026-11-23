import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { createLatestOnly } from '../../../../store/runtime/state-writes/latestOnly';
import { startPoll } from '../../../../shared/lib/usePoll/startPoll';
import { listenWorkChanged } from '../../../live-state/listenWorkChanged';
import { readLiveWork, type LiveWorkRow } from '../../../live-state/readLiveWork';
import { fleetPhraseOf } from '../../fleetPhraseOf';

export const FLEET_MIN_MS = 5_000;
export const FLEET_EVERY_MS = 15_000;
const READ_KEY = 'fleet';

type Rows = ReadonlyArray<LiveWorkRow>;

type Shown = {
  readonly phrase: string | null;
  readonly at: number;
};

type Waiting = {
  readonly phrase: string | null;
  readonly timer: ReturnType<typeof setTimeout>;
};

type Fleet = {
  bySession: ReadonlyMap<string, Rows>;
  shown: Map<string, Shown>;
  waiting: Map<string, Waiting>;
  listeners: Set<() => void>;
  readAt: number;
  readTimer: ReturnType<typeof setTimeout> | null;
  stop: (() => void) | null;
};

type RowsParams = {
  readonly rows: Rows;
};

type ListenerParams = {
  readonly listener: () => void;
};

type SessionParams = {
  readonly sessionId: string;
};

type PhraseParams = {
  readonly sessionId: string;
  readonly phrase: string | null;
};

type Params = {
  readonly sessionId: SessionId;
};

const NO_ROWS: Rows = [];
const latest = createLatestOnly();
const fleet: Fleet = {
  bySession: new Map(),
  shown: new Map(),
  waiting: new Map(),
  listeners: new Set(),
  readAt: 0,
  readTimer: null,
  stop: null,
};

const isVisible = (): boolean => document.visibilityState === 'visible';

const notifyFleet = (): void => {
  for (const listener of fleet.listeners) {
    listener();
  }
};

const signatureOf = ({ rows }: RowsParams): string =>
  rows
    .map((row) =>
      [
        row.runId,
        row.agentId,
        row.mountId,
        row.startedAt,
        row.tool?.name,
        row.tool?.command,
        row.tool?.path,
        row.hasToolCall,
        row.canSeeTools,
      ].join('|'),
    )
    .join('\n');

const applyRows = ({ rows }: RowsParams): void => {
  const grouped = new Map<string, Array<LiveWorkRow>>();
  for (const row of rows) {
    if (row.sessionId === null) {
      continue;
    }
    grouped.set(row.sessionId, [...(grouped.get(row.sessionId) ?? []), row]);
  }
  const next = new Map<string, Rows>();
  for (const [sessionId, sessionRows] of grouped) {
    const previous = fleet.bySession.get(sessionId);
    const kept =
      previous !== undefined &&
      signatureOf({ rows: previous }) === signatureOf({ rows: sessionRows })
        ? previous
        : sessionRows;
    next.set(sessionId, kept);
  }
  const hasChanged =
    next.size !== fleet.bySession.size ||
    [...next].some(([sessionId, sessionRows]) => fleet.bySession.get(sessionId) !== sessionRows);
  if (!hasChanged) {
    return;
  }
  fleet.bySession = next;
  notifyFleet();
};

const dropWaiting = ({ sessionId }: SessionParams): void => {
  const waiting = fleet.waiting.get(sessionId);
  if (waiting === undefined) {
    return;
  }
  clearTimeout(waiting.timer);
  fleet.waiting.delete(sessionId);
};

const showPhrase = ({ sessionId, phrase }: PhraseParams): void => {
  dropWaiting({ sessionId });
  fleet.shown.set(sessionId, { phrase, at: Date.now() });
  notifyFleet();
};

const showWaitingPhrase = ({ sessionId }: SessionParams): void => {
  const waiting = fleet.waiting.get(sessionId);
  if (waiting === undefined) {
    return;
  }
  showPhrase({ sessionId, phrase: waiting.phrase });
};

const offerPhrase = ({ sessionId, phrase }: PhraseParams): void => {
  if (fleet.stop === null) {
    return;
  }
  const shown = fleet.shown.get(sessionId);
  if ((shown?.phrase ?? null) === phrase) {
    dropWaiting({ sessionId });
    return;
  }
  const wait = shown === undefined ? 0 : shown.at + FLEET_MIN_MS - Date.now();
  if (wait <= 0) {
    showPhrase({ sessionId, phrase });
    return;
  }
  const timer =
    fleet.waiting.get(sessionId)?.timer ?? setTimeout(() => showWaitingPhrase({ sessionId }), wait);
  fleet.waiting.set(sessionId, { phrase, timer });
};

const read = async (): Promise<void> => {
  fleet.readTimer = null;
  if (!isVisible()) {
    return;
  }
  fleet.readAt = Date.now();
  const claim = latest.claim({ key: READ_KEY });
  try {
    const rows = await readLiveWork({ sessionId: null });
    if (claim.isCurrent() && fleet.stop !== null) {
      applyRows({ rows });
    }
  } catch {
    return;
  }
};

const requestRead = (): void => {
  if (fleet.readTimer !== null || !isVisible()) {
    return;
  }
  const wait = fleet.readAt + FLEET_MIN_MS - Date.now();
  if (wait <= 0) {
    void read();
    return;
  }
  fleet.readTimer = setTimeout(() => void read(), wait);
};

const startFleet = (): (() => void) => {
  let isActive = true;
  let unlisten: (() => void) | null = null;
  void listenWorkChanged({ onChange: () => requestRead() }).then((stop) => {
    if (!isActive) {
      stop();
      return;
    }
    unlisten = stop;
  });
  const stopPoll = startPoll({
    run: requestRead,
    everyMs: FLEET_EVERY_MS,
    gate: 'visible',
    isImmediate: true,
  });
  return () => {
    isActive = false;
    unlisten?.();
    stopPoll();
    latest.cancel({ key: READ_KEY });
    if (fleet.readTimer !== null) {
      clearTimeout(fleet.readTimer);
    }
    for (const sessionId of [...fleet.waiting.keys()]) {
      dropWaiting({ sessionId });
    }
    fleet.readTimer = null;
    fleet.readAt = 0;
    fleet.bySession = new Map();
    fleet.shown = new Map();
  };
};

const subscribeFleet = ({ listener }: ListenerParams): (() => void) => {
  fleet.listeners.add(listener);
  if (fleet.stop === null) {
    fleet.stop = startFleet();
  }
  return () => {
    fleet.listeners.delete(listener);
    if (fleet.listeners.size > 0 || fleet.stop === null) {
      return;
    }
    const stop = fleet.stop;
    fleet.stop = null;
    stop();
  };
};

const fleetRowsOf = ({ sessionId }: SessionParams): Rows =>
  fleet.bySession.get(sessionId) ?? NO_ROWS;

const shownPhraseOf = ({ sessionId }: SessionParams): string | null =>
  fleet.shown.get(sessionId)?.phrase ?? null;

export const useFleetPhrase = ({ sessionId }: Params): string | null => {
  const subscribe = useCallback((listener: () => void) => subscribeFleet({ listener }), []);
  const rowsSnapshot = useCallback(() => fleetRowsOf({ sessionId }), [sessionId]);
  const shownSnapshot = useCallback(() => shownPhraseOf({ sessionId }), [sessionId]);
  const rows = useSyncExternalStore(subscribe, rowsSnapshot, rowsSnapshot);
  const mounts = useAppStore((state) => state.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY);
  const phrase = useMemo(
    () =>
      rows.length === 0
        ? null
        : fleetPhraseOf({
            rows,
            mountNames: new Map(mounts.map((mount) => [mount.mountId, mount.mountName])),
          }),
    [mounts, rows],
  );
  useEffect(() => {
    offerPhrase({ sessionId, phrase });
  }, [sessionId, phrase]);
  return useSyncExternalStore(subscribe, shownSnapshot, shownSnapshot);
};
