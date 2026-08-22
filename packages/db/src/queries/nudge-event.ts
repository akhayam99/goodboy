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

type NudgeEventRow = {
  id: string;
  session_id: string | null;
  created_at: number;
  kind: string;
  context_json: string | null;
  outcome: string | null;
  outcome_ts: number | null;
};

function toNudgeEvent(row: NudgeEventRow): NudgeEvent {
  return {
    id: row.id,
    sessionId: row.session_id != null ? (row.session_id as SessionId) : null,
    ts: new Date(row.created_at).toISOString() as IsoDateTime,
    kind: row.kind as NudgeKind,
    contextJson: row.context_json,
    outcome: row.outcome != null ? (row.outcome as NudgeOutcome) : null,
    outcomeTs:
      row.outcome_ts != null ? (new Date(row.outcome_ts).toISOString() as IsoDateTime) : null,
  };
}

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

export const listNudgeEvents = async (
  db: Database,
  opts: ListNudgeEventsOptions = {},
): Promise<ReadonlyArray<NudgeEvent>> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.sinceTs) {
    where.push('created_at >= ?');
    params.push(Date.parse(opts.sinceTs));
  }
  if (opts.kind) {
    where.push('kind = ?');
    params.push(opts.kind);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const limitClause = opts.limit && opts.limit > 0 ? `LIMIT ${Math.floor(opts.limit)}` : '';
  const rows = await db.select<NudgeEventRow>(
    `SELECT * FROM nudge_events ${whereClause} ORDER BY created_at DESC ${limitClause}`,
    params,
  );
  return rows.map(toNudgeEvent);
};
