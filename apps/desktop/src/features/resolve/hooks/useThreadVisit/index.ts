import { useEffect, useRef, useState } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useUnreadThreads } from '../../../../shared/hooks/useUnreadThreads';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId | null;
};

type Visit = {
  readonly sessionId: SessionId | null;
  readonly threadIds: ReadonlySet<string>;
};

const NO_THREADS: ReadonlySet<string> = new Set<string>();
const NO_VISIT: Visit = { sessionId: null, threadIds: NO_THREADS };

export const useThreadVisit = ({ sessionId, mountId = null }: Params): ReadonlySet<string> => {
  const { unread, fetchedAtMs } = useUnreadThreads({ sessionId, mountId });
  const markThreadsRead = useAppStore((s) => s.markThreadsRead);
  const [snapshot, setSnapshot] = useState<Visit>(NO_VISIT);
  const inFlight = useRef<Visit>(NO_VISIT);

  useEffect(() => {
    if (unread === null) {
      return;
    }
    const pending =
      inFlight.current.sessionId === sessionId ? inFlight.current.threadIds : NO_THREADS;
    const fresh = unread.filter(({ threadId }) => !pending.has(threadId));
    if (fresh.length === 0) {
      return;
    }
    const freshIds = fresh.map(({ threadId }) => threadId);
    inFlight.current = { sessionId, threadIds: new Set([...pending, ...freshIds]) };
    setSnapshot((current) => ({
      sessionId,
      threadIds: new Set([
        ...(current.sessionId === sessionId ? current.threadIds : NO_THREADS),
        ...freshIds,
      ]),
    }));
    const fallbackMs = fetchedAtMs ?? Date.now();
    void markThreadsRead({
      sessionId,
      marks: fresh.map(({ threadId, latestOtherMs }) => ({
        threadId,
        readAt: latestOtherMs ?? fallbackMs,
      })),
    }).then(() => {
      if (inFlight.current.sessionId !== sessionId) {
        return;
      }
      inFlight.current = {
        sessionId,
        threadIds: new Set([...inFlight.current.threadIds].filter((id) => !freshIds.includes(id))),
      };
    });
  }, [fetchedAtMs, markThreadsRead, sessionId, unread]);

  return snapshot.sessionId === sessionId ? snapshot.threadIds : NO_THREADS;
};
