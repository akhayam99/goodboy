import type { Session } from '@goodboy/types';

export const LONG_RUNNING_MS = 24 * 60 * 60 * 1000;

type Params = {
  readonly running: ReadonlyArray<Session>;
  readonly sinceBySession: ReadonlyMap<string, number>;
  readonly nowMs: number;
};

export type LongRunning = {
  readonly session: Session;
  readonly activeMs: number;
};

export const longRunningOf = ({
  running,
  sinceBySession,
  nowMs,
}: Params): ReadonlyArray<LongRunning> =>
  running
    .flatMap((session) => {
      const since = sinceBySession.get(session.id);
      const activeMs = since === undefined ? 0 : nowMs - since;
      return activeMs >= LONG_RUNNING_MS ? [{ session, activeMs }] : [];
    })
    .sort((a, b) => b.activeMs - a.activeMs);
