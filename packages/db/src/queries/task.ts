import type {
  IsoDateTime,
  ProviderId,
  Task,
  TaskId,
  TaskProviderPreference,
  TurnState,
  WorkflowId,
  WorkspaceId,
} from '@kay-am/types';
import type { Database } from '../client';

interface TaskRow {
  id: string;
  workspace_id: string;
  goal: string;
  state_kind: TurnState['kind'];
  state_payload: string;
  provider_default: string;
  provider_allow_override: number;
  workflow_id: string | null;
  current_step_ordinal: number | null;
  created_at: number;
  updated_at: number;
}

function toState(kind: TurnState['kind'], payload: string): TurnState {
  const data = JSON.parse(payload) as Record<string, unknown>;
  return { kind, ...data } as TurnState;
}

const VALID_PROVIDER_IDS: ReadonlySet<string> = new Set(['anthropic', 'cursor', 'codex']);

function toProviderPreference(row: TaskRow): TaskProviderPreference {
  const defaultProvider: ProviderId = VALID_PROVIDER_IDS.has(row.provider_default)
    ? (row.provider_default as ProviderId)
    : 'anthropic';
  return {
    defaultProvider,
    allowTurnOverride: row.provider_allow_override !== 0,
  };
}

function toDomain(row: TaskRow, contextSlots: Task['contextSlots']): Task {
  return {
    id: row.id as TaskId,
    workspaceId: row.workspace_id as WorkspaceId,
    goal: row.goal,
    state: toState(row.state_kind, row.state_payload),
    contextSlots,
    providerPreference: toProviderPreference(row),
    ...(row.workflow_id && { workflowId: row.workflow_id as WorkflowId }),
    ...(row.current_step_ordinal !== null && { currentStepOrdinal: row.current_step_ordinal }),
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  };
}

function splitState(state: TurnState): { kind: TurnState['kind']; payload: string } {
  const { kind, ...rest } = state;
  return { kind, payload: JSON.stringify(rest) };
}

export async function insertTask(db: Database, task: Task): Promise<void> {
  const { kind, payload } = splitState(task.state);
  await db.execute(
    `INSERT INTO tasks
      (id, workspace_id, goal, state_kind, state_payload, provider_default, provider_allow_override, workflow_id, current_step_ordinal, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.workspaceId,
      task.goal,
      kind,
      payload,
      task.providerPreference.defaultProvider,
      task.providerPreference.allowTurnOverride ? 1 : 0,
      task.workflowId ?? null,
      task.currentStepOrdinal ?? null,
      Date.parse(task.createdAt),
      Date.parse(task.updatedAt),
    ],
  );
}

export async function updateTaskState(
  db: Database,
  id: TaskId,
  state: TurnState,
  updatedAt: IsoDateTime,
): Promise<void> {
  const { kind, payload } = splitState(state);
  await db.execute(
    'UPDATE tasks SET state_kind = ?, state_payload = ?, updated_at = ? WHERE id = ?',
    [kind, payload, Date.parse(updatedAt), id],
  );
}

export async function getTaskById(db: Database, id: TaskId): Promise<Task | null> {
  const rows = await db.select<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
  const row = rows[0];
  if (!row) return null;
  return toDomain(row, []);
}

export async function listTasksForWorkspace(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<Task>> {
  const rows = await db.select<TaskRow>(
    'SELECT * FROM tasks WHERE workspace_id = ? ORDER BY updated_at DESC',
    [workspaceId],
  );
  return rows.map((row) => toDomain(row, []));
}

export async function renameTask(
  db: Database,
  id: TaskId,
  goal: string,
  updatedAt: IsoDateTime,
): Promise<void> {
  await db.execute('UPDATE tasks SET goal = ?, updated_at = ? WHERE id = ?', [
    goal,
    Date.parse(updatedAt),
    id,
  ]);
}

export async function deleteTask(db: Database, id: TaskId): Promise<void> {
  await db.execute('DELETE FROM tasks WHERE id = ?', [id]);
}
