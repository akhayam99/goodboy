import type { IsoDateTime, SessionId } from '@goodboy/types';
import type { Database } from '../client';

export type NudgeKind = 'model-rightsize' | 'scope-mismatch' | 'plan-ready' | 'handoff-suggested';

export type NextStepNudgeKind = `next:${string}`;

export type NudgeEventKind = NudgeKind | NextStepNudgeKind;

export type NudgeOutcome = 'accepted' | 'dismissed' | 'overridden' | 'ignored';

export type NudgeEvent = {
  readonly id: string;
  readonly sessionId: SessionId | null;
  readonly ts: IsoDateTime;
  readonly kind: NudgeEventKind;
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
  readonly kind?: NudgeEventKind;
  readonly limit?: number;
};

type ListParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly sinceTs: IsoDateTime;
};

type Row = {
  readonly id: string;
  readonly sessionId: SessionId | null;
  readonly ts: number;
  readonly kind: NudgeEventKind;
  readonly contextJson: string | null;
  readonly outcome: NudgeOutcome | null;
  readonly outcomeTs: number | null;
};

const hydrate = ({ row }: { readonly row: Row }): NudgeEvent => ({
  id: row.id,
  sessionId: row.sessionId,
  ts: new Date(row.ts).toISOString() as IsoDateTime,
  kind: row.kind,
  contextJson: row.contextJson,
  outcome: row.outcome,
  outcomeTs: row.outcomeTs == null ? null : (new Date(row.outcomeTs).toISOString() as IsoDateTime),
});

export const listNudgeEvents = async ({
  db,
  sessionId,
  sinceTs,
}: ListParams): Promise<ReadonlyArray<NudgeEvent>> => {
  const rows = await db.select<Row>(
    `SELECT id, session_id AS sessionId, created_at AS ts, kind, context_json AS contextJson,
       outcome, outcome_ts AS outcomeTs
     FROM nudge_events
     WHERE session_id = ? AND created_at >= ?
     ORDER BY created_at, rowid`,
    [sessionId, Date.parse(sinceTs)],
  );
  return rows.map((row) => hydrate({ row }));
};
