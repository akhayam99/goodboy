import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../../store';
import {
  createLatestOnly,
  type LatestClaim,
} from '../../../../../store/runtime/state-writes/latestOnly';
import { usePoll } from '../../../../../shared/lib/usePoll';
import { listenWorkChanged } from '../../../../live-state/listenWorkChanged';
import { readLiveWork, type LiveWorkRow } from '../../../../live-state/readLiveWork';
import { workOf, type Work } from '../../../../live-state/workOf';
import { earlierStepsOf, type EarlierSteps } from '../../earlierStepsOf';

export const FLEET_EVERY_MS = 10_000;
const READ_KEY = 'fleet';

type Params = {
  readonly sessionTitles: ReadonlyMap<string, string>;
};

type Fleet = Readonly<{
  rows: ReadonlyArray<LiveWorkRow>;
  earlier: EarlierSteps;
}>;

type Queued = Readonly<{
  rows: ReadonlyArray<LiveWorkRow>;
  claim: LatestClaim;
}>;

type Pace = {
  at: number;
  timer: ReturnType<typeof setTimeout> | null;
  next: Queued | null;
};

type ApplyParams = {
  readonly next: ReadonlyArray<LiveWorkRow>;
  readonly claim: LatestClaim;
};

type RunParams = {
  readonly runId: string;
};

export type FleetWork = Readonly<{
  work: ReadonlyArray<Work>;
  earlierOf: (params: RunParams) => ReadonlyArray<string>;
  isLoaded: boolean;
  hasFailed: boolean;
  retry: () => void;
}>;

const NO_FLEET: Fleet = { rows: [], earlier: {} };

export const useFleetWork = ({ sessionTitles }: Params): FleetWork => {
  const [fleet, setFleet] = useState<Fleet>(NO_FLEET);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const latest = useMemo(() => createLatestOnly(), []);
  const pace = useRef<Pace>({ at: 0, timer: null, next: null });
  const mountNames = useAppStore(
    useShallow((state) => {
      const picked: Record<string, string> = {};
      for (const row of fleet.rows) {
        const mount =
          row.sessionId === null || row.mountId === null
            ? undefined
            : state.sessionProjectMounts[row.sessionId]?.find(
                (candidate) => candidate.mountId === row.mountId,
              );
        if (mount !== undefined && row.mountId !== null) {
          picked[row.mountId] = mount.mountName;
        }
      }
      return picked;
    }),
  );

  const apply = useCallback(({ next, claim }: ApplyParams) => {
    const current = pace.current;
    current.next = { rows: next, claim };
    if (current.timer !== null) {
      return;
    }
    const flush = () => {
      current.timer = null;
      current.at = Date.now();
      const value = current.next;
      current.next = null;
      if (value === null || !value.claim.isCurrent()) {
        return;
      }
      setFleet((previous) => ({
        rows: value.rows,
        earlier: earlierStepsOf({
          previous: previous.rows,
          earlier: previous.earlier,
          next: value.rows,
        }),
      }));
      setIsLoaded(true);
      setHasFailed(false);
    };
    const wait = current.at + FLEET_EVERY_MS - Date.now();
    if (wait <= 0) {
      flush();
      return;
    }
    current.timer = setTimeout(flush, wait);
  }, []);

  const read = useCallback(async () => {
    const claim = latest.claim({ key: READ_KEY });
    try {
      const next = await readLiveWork({ sessionId: null });
      if (claim.isCurrent()) {
        apply({ next, claim });
      }
    } catch {
      if (claim.isCurrent()) {
        setHasFailed(true);
      }
    }
  }, [apply, latest]);

  useEffect(() => {
    const current = pace.current;
    return () => {
      latest.cancel({ key: READ_KEY });
      if (current.timer !== null) {
        clearTimeout(current.timer);
      }
      current.timer = null;
      current.next = null;
    };
  }, [latest]);

  useEffect(() => {
    let isActive = true;
    let unlisten: (() => void) | null = null;
    void listenWorkChanged({ onChange: () => void read() }).then((stop) => {
      if (!isActive) {
        stop();
        return;
      }
      unlisten = stop;
    });
    return () => {
      isActive = false;
      unlisten?.();
    };
  }, [read]);

  usePoll({ run: read, everyMs: FLEET_EVERY_MS, restartKey: READ_KEY });

  const names = useMemo(() => new Map(Object.entries(mountNames)), [mountNames]);
  const work = useMemo(
    () =>
      workOf({
        rows: fleet.rows.filter(
          (row) => row.sessionId !== null && sessionTitles.has(row.sessionId),
        ),
        mountNames: names,
        sessionTitles,
      }),
    [fleet.rows, names, sessionTitles],
  );
  const earlierOf = useCallback(
    ({ runId }: RunParams): ReadonlyArray<string> =>
      workOf({ rows: fleet.earlier[runId] ?? [], mountNames: names, sessionTitles }).map(
        (step) => step.phrase,
      ),
    [fleet.earlier, names, sessionTitles],
  );

  const retry = useCallback(() => void read(), [read]);

  return { work, earlierOf, isLoaded, hasFailed, retry };
};
