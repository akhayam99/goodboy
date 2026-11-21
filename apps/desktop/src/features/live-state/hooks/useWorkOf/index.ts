import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../../store';
import { createLatestOnly } from '../../../../store/runtime/state-writes/latestOnly';
import { selectSessionById } from '../../../../store/slices/sessions/selectSessionById';
import { usePoll } from '../../../../shared/lib/usePoll';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';
import { listenWorkChanged } from '../../listenWorkChanged';
import { readLiveWork, type LiveWorkRow } from '../../readLiveWork';
import { workOf, type Work } from '../../workOf';

export const PHRASE_EVERY_MS = 1000;
const QUIET_EVERY_MS = 5000;
const READ_KEY = 'work';

type Params = {
  readonly sessionId: string;
};

type Pace = {
  at: number;
  timer: ReturnType<typeof setTimeout> | null;
  next: ReadonlyArray<LiveWorkRow> | null;
};

type ApplyParams = {
  readonly next: ReadonlyArray<LiveWorkRow>;
};

export type SessionWork = Readonly<{
  work: ReadonlyArray<Work>;
  isLoaded: boolean;
  hasFailed: boolean;
}>;

const NO_ROWS: ReadonlyArray<LiveWorkRow> = [];

export const useWorkOf = ({ sessionId }: Params): SessionWork => {
  const [rows, setRows] = useState<ReadonlyArray<LiveWorkRow>>(NO_ROWS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const latest = useMemo(() => createLatestOnly(), []);
  const pace = useRef<Pace>({ at: 0, timer: null, next: null });
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId]);
  const goal = useAppStore((state) => selectSessionById(state, sessionId)?.goal ?? null);

  const apply = useCallback(({ next }: ApplyParams) => {
    const current = pace.current;
    current.next = next;
    if (current.timer !== null) {
      return;
    }
    const flush = () => {
      current.timer = null;
      current.at = Date.now();
      const value = current.next;
      current.next = null;
      if (value === null) {
        return;
      }
      setRows(value);
      setIsLoaded(true);
      setHasFailed(false);
    };
    const wait = current.at + PHRASE_EVERY_MS - Date.now();
    if (wait <= 0) {
      flush();
      return;
    }
    current.timer = setTimeout(flush, wait);
  }, []);

  const read = useCallback(async () => {
    const claim = latest.claim({ key: READ_KEY });
    try {
      const next = await readLiveWork({ sessionId });
      if (claim.isCurrent()) {
        apply({ next });
      }
    } catch {
      if (claim.isCurrent()) {
        setHasFailed(true);
      }
    }
  }, [apply, latest, sessionId]);

  useEffect(() => {
    const current = pace.current;
    setRows(NO_ROWS);
    setIsLoaded(false);
    setHasFailed(false);
    return () => {
      latest.cancel({ key: READ_KEY });
      if (current.timer !== null) {
        clearTimeout(current.timer);
      }
      current.timer = null;
      current.next = null;
      current.at = 0;
    };
  }, [latest, sessionId]);

  useEffect(() => {
    let isActive = true;
    let unlisten: (() => void) | null = null;
    void listenWorkChanged({
      onChange: ({ change }) => {
        if (change.sessionId === sessionId) {
          void read();
        }
      },
    }).then((stop) => {
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
  }, [read, sessionId]);

  usePoll({ run: read, everyMs: QUIET_EVERY_MS, restartKey: sessionId });

  const work = useMemo(
    () =>
      workOf({
        rows,
        mountNames: new Map((mounts ?? []).map((mount) => [mount.mountId, mount.mountName])),
        sessionTitles: new Map([[sessionId, sessionTitle({ session: { goal: goal ?? '' } })]]),
      }),
    [goal, mounts, rows, sessionId],
  );

  return { work, isLoaded, hasFailed };
};
