import { useEffect, useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ReviewEntry } from '../../components/ReviewFlow/useReviewEntries';
import { useNewThreadIds } from '../useNewThreadIds';

type Params = {
  readonly sessionId: SessionId;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

type Visit = {
  readonly sessionId: SessionId | null;
  readonly threadIds: ReadonlySet<string>;
};

const NO_THREADS: ReadonlySet<string> = new Set<string>();
const NO_VISIT: Visit = { sessionId: null, threadIds: NO_THREADS };

export const useThreadVisit = ({ sessionId, entries }: Params): ReadonlySet<string> => {
  const { newThreadIds, isLoaded } = useNewThreadIds({ sessionId, entries });
  const markThreadsRead = useAppStore((s) => s.markThreadsRead);
  const [snapshot, setSnapshot] = useState<Visit>(NO_VISIT);
  const inFlight = useRef<Visit>(NO_VISIT);
  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    const pending =
      inFlight.current.sessionId === sessionId ? inFlight.current.threadIds : NO_THREADS;
    const fresh = [...newThreadIds].filter((threadId) => !pending.has(threadId));
    if (fresh.length === 0) {
      return;
    }
    inFlight.current = { sessionId, threadIds: new Set([...pending, ...fresh]) };
    setSnapshot((current) => ({
      sessionId,
      threadIds: new Set([
        ...(current.sessionId === sessionId ? current.threadIds : NO_THREADS),
        ...fresh,
      ]),
    }));
    void markThreadsRead({ sessionId, threadIds: fresh }).then((isSaved) => {
      if (isSaved || inFlight.current.sessionId !== sessionId) {
        return;
      }
      inFlight.current = {
        sessionId,
        threadIds: new Set([...inFlight.current.threadIds].filter((id) => !fresh.includes(id))),
      };
    });
  }, [isLoaded, markThreadsRead, newThreadIds, sessionId]);
  return snapshot.sessionId === sessionId ? snapshot.threadIds : NO_THREADS;
};
