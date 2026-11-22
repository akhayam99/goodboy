import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WorkEvent } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const NO_EVENTS: ReadonlyArray<WorkEvent> = [];

type Params = {
  readonly sessionId: SessionId;
};

export type WorkEvents = {
  readonly events: ReadonlyArray<WorkEvent>;
  readonly error: Error | null;
  readonly retry: () => void;
};

export const useWorkEvents = ({ sessionId }: Params): WorkEvents => {
  const loadWorkEvents = useAppStore((s) => s.loadWorkEvents);
  const events = useAppStore((s) => s.workEvents[sessionId] ?? NO_EVENTS);
  const message = useAppStore((s) => s.workEventsError[sessionId] ?? null);
  const runKey = useAppStore((s) =>
    Object.values(s.scriptRuns[sessionId] ?? {})
      .map((run) => `${run.runId}:${run.status}`)
      .sort()
      .join(' '),
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    void loadWorkEvents({ sessionId });
  }, [attempt, loadWorkEvents, runKey, sessionId]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const error = useMemo(() => (message === null ? null : new Error(message)), [message]);
  return { events, error, retry };
};
