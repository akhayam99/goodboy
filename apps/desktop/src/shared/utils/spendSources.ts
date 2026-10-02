import type { DormantTelemetry } from '@goodboy/db';
import type { Session, SessionId, TelemetryRecord } from '@goodboy/types';

export type SpendSource = {
  readonly sessionId: SessionId;
  readonly goal: string;
  readonly isDeleted: boolean;
  readonly records: ReadonlyArray<TelemetryRecord>;
};

type Params = {
  readonly sessions: ReadonlyArray<Pick<Session, 'id' | 'goal'>>;
  readonly telemetryMap: Readonly<Record<string, ReadonlyArray<TelemetryRecord>>>;
  readonly dormant: ReadonlyArray<DormantTelemetry>;
};

const NO_RECORDS: ReadonlyArray<TelemetryRecord> = [];

export const spendSources = ({
  sessions,
  telemetryMap,
  dormant,
}: Params): ReadonlyArray<SpendSource> => {
  const live = sessions.map((session) => ({
    sessionId: session.id,
    goal: session.goal,
    isDeleted: false,
    records: telemetryMap[session.id] ?? NO_RECORDS,
  }));
  const liveIds = new Set<string>(sessions.map((session) => session.id));
  const past = new Map<SessionId, SpendSource & { readonly records: TelemetryRecord[] }>();
  for (const entry of dormant) {
    const sessionId = entry.record.sessionId;
    if (liveIds.has(sessionId)) {
      continue;
    }
    const current = past.get(sessionId);
    if (current !== undefined) {
      current.records.push(entry.record);
      continue;
    }
    past.set(sessionId, {
      sessionId,
      goal: entry.goal,
      isDeleted: entry.isDeleted,
      records: [entry.record],
    });
  }
  return [...live, ...past.values()];
};
