import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WorkEvent } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const NO_EVENTS: ReadonlyArray<WorkEvent> = [];

const WORK_EVENTS_PAGE = 200;

type Params = {
  readonly sessionId: SessionId;
};

type Paging = {
  readonly sessionId: SessionId;
  readonly limit: number;
};

export type WorkEvents = {
  readonly events: ReadonlyArray<WorkEvent>;
  readonly error: Error | null;
  readonly retry: () => void;
  readonly hasOlder: boolean;
  readonly loadOlder: () => void;
};

export const useWorkEvents = ({ sessionId }: Params): WorkEvents => {
  const loadWorkEvents = useAppStore((s) => s.loadWorkEvents);
  const events = useAppStore((s) => s.workEvents[sessionId] ?? NO_EVENTS);
  const message = useAppStore((s) => s.workEventsError[sessionId] ?? null);
  const runKey = useAppStore((s) =>
    Object.values(s.scriptRuns[sessionId] ?? {})
      .map(
        (run) => `${run.runId}:${run.status}:${run.isLaunched === true}:${run.completedAt ?? ''}`,
      )
      .sort()
      .join(' '),
  );
  const [attempt, setAttempt] = useState(0);
  const [paging, setPaging] = useState<Paging>({ sessionId, limit: WORK_EVENTS_PAGE });
  const limit = paging.sessionId === sessionId ? paging.limit : WORK_EVENTS_PAGE;

  useEffect(() => {
    void loadWorkEvents({ sessionId, limit });
  }, [attempt, limit, loadWorkEvents, runKey, sessionId]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const loadOlder = useCallback(
    () => setPaging({ sessionId, limit: limit + WORK_EVENTS_PAGE }),
    [limit, sessionId],
  );
  const error = useMemo(() => (message === null ? null : new Error(message)), [message]);
  return { events, error, retry, hasOlder: events.length >= limit, loadOlder };
};
