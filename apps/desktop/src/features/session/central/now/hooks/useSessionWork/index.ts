import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { createLatestOnly } from '../../../../../../store/runtime/state-writes/latestOnly';
import { usePoll } from '../../../../../../shared/lib/usePoll';
import { listenWorkChanged } from '../../../../../live-state/listenWorkChanged';
import { readLiveWork, type LiveWorkRow } from '../../../../../live-state/readLiveWork';
import { workOf, type Work } from '../../../../../live-state/workOf';

const PHRASE_EVERY_MS = 1000;
const QUIET_EVERY_MS = 5000;
const READ_KEY = 'now';

type Params = {
  readonly sessionId: SessionId;
};

type Result = Readonly<{
  work: ReadonlyArray<Work>;
  isLoaded: boolean;
}>;

const NO_ROWS: ReadonlyArray<LiveWorkRow> = [];

export const useSessionWork = ({ sessionId }: Params): Result => {
  const [rows, setRows] = useState<ReadonlyArray<LiveWorkRow>>(NO_ROWS);
  const [isLoaded, setIsLoaded] = useState(false);
  const latest = useMemo(() => createLatestOnly(), []);
  const lastAt = useRef(0);
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId]);

  const trailing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const read = useCallback(async (): Promise<void> => {
    const wait = lastAt.current + PHRASE_EVERY_MS - Date.now();
    if (wait > 0) {
      if (trailing.current === null) {
        trailing.current = setTimeout(() => {
          trailing.current = null;
          void read();
        }, wait);
      }
      return;
    }
    lastAt.current = Date.now();
    const claim = latest.claim({ key: READ_KEY });
    try {
      const next = await readLiveWork({ sessionId });
      if (claim.isCurrent()) {
        setRows(next);
        setIsLoaded(true);
      }
    } catch {
      return;
    }
  }, [latest, sessionId]);

  useEffect(() => {
    setRows(NO_ROWS);
    setIsLoaded(false);
    lastAt.current = 0;
    return () => {
      latest.cancel({ key: READ_KEY });
      if (trailing.current !== null) {
        clearTimeout(trailing.current);
      }
      trailing.current = null;
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
        sessionTitles: new Map(),
      }),
    [mounts, rows],
  );
  return { work, isLoaded };
};
