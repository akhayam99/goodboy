import type { ProviderRunId, SessionId, TaskId, TurnEvent } from '@kay-am/types';
import type { Database } from '../client';

interface TurnEventRow {
  id: string;
  task_id: string;
  agent_id: string;
  payload: string;
  created_at: number;
}

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

export async function insertTurnEvent(
  db: Database,
  args: {
    readonly id: string;
    readonly taskId: TaskId;
    readonly agentId: SessionId;
    readonly event: TurnEvent;
  },
): Promise<void> {
  await db.execute(
    `INSERT INTO turn_events (id, task_id, agent_id, payload, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [args.id, args.taskId, args.agentId, JSON.stringify(args.event), eventTimestamp(args.event)],
  );
}

export async function listTurnEventsForAgent(
  db: Database,
  agentId: SessionId,
): Promise<ReadonlyArray<TurnEvent>> {
  const rows = await db.select<TurnEventRow>(
    'SELECT * FROM turn_events WHERE agent_id = ? ORDER BY created_at ASC, rowid ASC',
    [agentId],
  );
  return rows.map(rowToEvent).filter((e): e is TurnEvent => e !== null);
}

export async function listTurnEventsForTask(
  db: Database,
  taskId: TaskId,
): Promise<ReadonlyArray<TurnEvent>> {
  const rows = await db.select<TurnEventRow>(
    'SELECT * FROM turn_events WHERE task_id = ? ORDER BY created_at ASC, rowid ASC',
    [taskId],
  );
  return rows.map(rowToEvent).filter((e): e is TurnEvent => e !== null);
}

export async function listAgentRunIdsForTask(
  db: Database,
  taskId: TaskId,
): Promise<Map<SessionId, ReadonlyArray<ProviderRunId>>> {
  const rows = await db.select<TurnEventRow>(
    'SELECT * FROM turn_events WHERE task_id = ? ORDER BY created_at ASC, rowid ASC',
    [taskId],
  );
  const result = new Map<SessionId, ProviderRunId[]>();
  const seen = new Map<SessionId, Set<string>>();
  for (const row of rows) {
    const event = rowToEvent(row);
    if (!event) continue;
    const runId = event.runId;
    if (!runId || runId === ('history' as ProviderRunId)) continue;
    const agentId = row.agent_id as SessionId;
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
}
