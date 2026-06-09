import type { AgentId, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import type { Database } from '../client';

type TurnEventRow = {
  id: string;
  session_id: string;
  agent_id: string;
  payload: string;
  created_at: number;
};

function rowToEvent(row: TurnEventRow): TurnEvent | null {
  try {
    return JSON.parse(row.payload) as TurnEvent;
  } catch {
    return null;
  }
}

function eventTimestamp(event: TurnEvent): number {
  if ('at' in event && typeof event.at === 'string') {
    const parsed = Date.parse(event.at);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

export const insertTurnEvent = async (
  db: Database,
  args: {
    readonly id: string;
    readonly sessionId: SessionId;
    readonly agentId: AgentId;
    readonly event: TurnEvent;
  },
): Promise<void> => {
  await db.execute(
    `INSERT INTO turn_events (id, session_id, agent_id, payload, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [args.id, args.sessionId, args.agentId, JSON.stringify(args.event), eventTimestamp(args.event)],
  );
};

export type PendingTurnEventInsert = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly event: TurnEvent;
};

export const insertTurnEventsBatch = async (
  db: Database,
  inserts: ReadonlyArray<PendingTurnEventInsert>,
): Promise<void> => {
  if (inserts.length === 0) return;
  if (inserts.length === 1) {
    const ins = inserts[0]!;
    await insertTurnEvent(db, ins);
    return;
  }
  const placeholders = inserts.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const values: unknown[] = [];
  for (const ins of inserts) {
    values.push(
      ins.id,
      ins.sessionId,
      ins.agentId,
      JSON.stringify(ins.event),
      eventTimestamp(ins.event),
    );
  }
  await db.execute(
    `INSERT INTO turn_events (id, session_id, agent_id, payload, created_at) VALUES ${placeholders}`,
    values,
  );
};

export const listTurnEventsForAgent = async (
  db: Database,
  agentId: AgentId,
  opts?: { readonly limit?: number },
): Promise<ReadonlyArray<TurnEvent>> => {
  if (opts?.limit !== undefined) {
    const rows = await db.select<TurnEventRow>(
      'SELECT * FROM turn_events WHERE agent_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?',
      [agentId, opts.limit],
    );
    const events = rows.map(rowToEvent).filter((e): e is TurnEvent => e !== null);
    events.reverse();
    return events;
  }
  const rows = await db.select<TurnEventRow>(
    'SELECT * FROM turn_events WHERE agent_id = ? ORDER BY created_at ASC, rowid ASC',
    [agentId],
  );
  return rows.map(rowToEvent).filter((e): e is TurnEvent => e !== null);
};

export const listTurnEventsForSession = async (
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<TurnEvent>> => {
  const rows = await db.select<TurnEventRow>(
    'SELECT * FROM turn_events WHERE session_id = ? ORDER BY created_at ASC, rowid ASC',
    [sessionId],
  );
  return rows.map(rowToEvent).filter((e): e is TurnEvent => e !== null);
};

export const listAgentRunIdsForSession = async (
  db: Database,
  sessionId: SessionId,
): Promise<Map<AgentId, ReadonlyArray<ProviderRunId>>> => {
  const rows = await db.select<TurnEventRow>(
    'SELECT * FROM turn_events WHERE session_id = ? ORDER BY created_at ASC, rowid ASC',
    [sessionId],
  );
  const result = new Map<AgentId, ProviderRunId[]>();
  const seen = new Map<AgentId, Set<string>>();
  for (const row of rows) {
    const event = rowToEvent(row);
    if (!event) continue;
    const runId = event.runId;
    if (!runId || runId === ('history' as ProviderRunId)) continue;
    const agentId = row.agent_id as AgentId;
    let bucket = seen.get(agentId);
    if (!bucket) {
      bucket = new Set();
      seen.set(agentId, bucket);
      result.set(agentId, []);
    }
    if (bucket.has(runId)) continue;
    bucket.add(runId);
    result.get(agentId)!.push(runId);
  }
  return result;
};
