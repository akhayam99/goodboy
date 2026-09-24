import type { IsoDateTime, SessionId } from '@goodboy/types';
import type { Database } from '../client';

export type NudgeKind = 'model-rightsize' | 'scope-mismatch' | 'plan-ready' | 'handoff-suggested';

export type NudgeOutcome = 'accepted' | 'dismissed' | 'overridden' | 'ignored';

export type NudgeEvent = {
  readonly id: string;
  readonly sessionId: SessionId | null;
  readonly ts: IsoDateTime;
  readonly kind: NudgeKind;
  readonly contextJson: string | null;
  readonly outcome: NudgeOutcome | null;
  readonly outcomeTs: IsoDateTime | null;
};

type NewNudgeEvent = Omit<NudgeEvent, 'sessionId'> & {
  readonly sessionId: SessionId;
};

export const insertNudgeEvent = async (db: Database, event: NewNudgeEvent): Promise<void> => {
  await db.execute(
    `INSERT INTO nudge_events (id, session_id, created_at, kind, context_json, outcome, outcome_ts)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.sessionId,
      Date.parse(event.ts),
      event.kind,
      event.contextJson ?? null,
      event.outcome ?? null,
      event.outcomeTs != null ? Date.parse(event.outcomeTs) : null,
    ],
  );
};

export const updateNudgeEventOutcome = async (
  db: Database,
  id: string,
  outcome: NudgeOutcome,
  outcomeTs: IsoDateTime,
): Promise<void> => {
  await db.execute(`UPDATE nudge_events SET outcome = ?, outcome_ts = ? WHERE id = ?`, [
    outcome,
    Date.parse(outcomeTs),
    id,
  ]);
};

export type ListNudgeEventsOptions = {
  readonly sinceTs?: IsoDateTime;
  readonly kind?: NudgeKind;
  readonly limit?: number;
};
