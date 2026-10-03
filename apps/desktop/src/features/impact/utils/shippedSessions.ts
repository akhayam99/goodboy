import type { ImpactSession, PullRequestEntry } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';

export type ShippedSession = {
  readonly sessionId: SessionId;
  readonly goal: string;
  readonly merged: number;
  readonly spendUsd: number | null;
  readonly hours: number | null;
  readonly isDeleted: boolean;
};

type Params = {
  readonly entries: ReadonlyArray<PullRequestEntry>;
  readonly durations: ReadonlyArray<ImpactSession>;
  readonly limit: number;
};

type SessionSpendParams = {
  readonly total: number | null;
  readonly spendUsd: number | null;
};

const sessionSpend = ({ total, spendUsd }: SessionSpendParams): number | null => {
  if (spendUsd === null) {
    return total;
  }
  return Math.max(total ?? 0, spendUsd);
};

export const shippedSessions = ({
  entries,
  durations,
  limit,
}: Params): ReadonlyArray<ShippedSession> => {
  const bySession = new Map<SessionId, ShippedSession>();
  for (const entry of entries) {
    if (entry.state !== 'merged') {
      continue;
    }
    const current = bySession.get(entry.sessionId);
    bySession.set(entry.sessionId, {
      sessionId: entry.sessionId,
      goal: entry.goal,
      merged: (current?.merged ?? 0) + 1,
      spendUsd: sessionSpend({ total: current?.spendUsd ?? null, spendUsd: entry.spendUsd }),
      hours: durations.find((session) => session.sessionId === entry.sessionId)?.value ?? null,
      isDeleted: entry.isDeleted,
    });
  }
  return [...bySession.values()]
    .sort(
      (left, right) => right.merged - left.merged || (right.spendUsd ?? 0) - (left.spendUsd ?? 0),
    )
    .slice(0, limit);
};
