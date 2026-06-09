import type { IsoDateTime } from '@goodboy/types';
import type { Database } from '../client';

export type NudgeKind = 'model-rightsize' | 'scope-mismatch' | 'plan-ready' | 'handoff-suggested';

export type NudgeOutcome = 'accepted' | 'dismissed' | 'overridden' | 'ignored';

export type NudgeEvent = {
  readonly id: string;
  readonly ts: IsoDateTime;
  readonly kind: NudgeKind;
  readonly contextJson: string | null;
  readonly outcome: NudgeOutcome | null;
  readonly outcomeTs: IsoDateTime | null;
};

type NudgeEventRow = {
  id: string;
  ts: string;
  kind: string;
  context_json: string | null;
  outcome: string | null;
  outcome_ts: string | null;
};

function toNudgeEvent(row: NudgeEventRow): NudgeEvent {
  return {
    id: row.id,
    ts: row.ts as IsoDateTime,
    kind: row.kind as NudgeKind,
    contextJson: row.context_json,
    outcome: row.outcome ? (row.outcome as NudgeOutcome) : null,
    outcomeTs: row.outcome_ts ? (row.outcome_ts as IsoDateTime) : null,
  };
}

export const insertNudgeEvent = async (db: Database, event: NudgeEvent): Promise<void> => {
  await db.execute(
    `INSERT INTO nudge_events (id, ts, kind, context_json, outcome, outcome_ts)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.ts,
      event.kind,
      event.contextJson ?? null,
      event.outcome ?? null,
      event.outcomeTs ?? null,
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
    outcomeTs,
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
  const params: Array<string> = [];
  if (opts.sinceTs) {
    where.push('ts >= ?');
    params.push(opts.sinceTs);
  }
  if (opts.kind) {
    where.push('kind = ?');
    params.push(opts.kind);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const limitClause = opts.limit && opts.limit > 0 ? `LIMIT ${Math.floor(opts.limit)}` : '';
  const rows = await db.select<NudgeEventRow>(
    `SELECT * FROM nudge_events ${whereClause} ORDER BY ts DESC ${limitClause}`,
    params,
  );
  return rows.map(toNudgeEvent);
};
