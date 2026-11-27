import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { longRunningOf, type LongRunning } from '../../reads/longRunningOf';
import { runningSinceOf } from '../../widgets/RunningNow/runningSinceOf';
import type { HomeFacts } from '../useHomeFacts';

type Params = {
  readonly facts: HomeFacts;
};

const CLOCK_MS = 60_000;

export const useLongRunning = ({ facts }: Params): ReadonlyArray<LongRunning> => {
  const nowMs = useNow(CLOCK_MS);
  const sinceList = useAppStore(
    useShallow((state) =>
      facts.running.flatMap((session) => {
        const since = runningSinceOf({ state, sessionId: session.id });
        return since === null ? [] : [`${session.id}|${since}`];
      }),
    ),
  );
  return useMemo(() => {
    const sinceBySession = new Map<string, number>(
      sinceList.map((entry) => {
        const [id = '', since = '0'] = entry.split('|');
        return [id, Number(since)];
      }),
    );
    return longRunningOf({ running: facts.running, sinceBySession, nowMs });
  }, [facts.running, nowMs, sinceList]);
};
