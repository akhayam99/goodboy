import type {
  ClaudePermissionMode,
  IsoDateTime,
  ProviderId,
  Session,
  SessionId,
  SessionProviderPreference,
  SessionUserStatus,
  TurnState,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';

interface SessionRow {
  id: string;
  workspace_id: string;
  goal: string;
  state_kind: TurnState['kind'];
  state_payload: string;
  provider_default: string;
  provider_allow_override: number;
  permission_mode: string | null;
  workflow_id: string | null;
  current_step_ordinal: number | null;
  auto_run: number;
  title_user_edited: number;
  archived_at: number | null;
  deleted_at: number | null;
  verbosity: string | null;
  effort: string | null;
  model_override: string | null;
  provider_override: string | null;
  user_status: string;
  created_at: number;
  updated_at: number;
}

const VALID_USER_STATUSES: ReadonlySet<SessionUserStatus> = new Set([
  'wip',
  'waiting',
  'blocked',
  'done',
]);

function toUserStatus(raw: string): SessionUserStatus {
  if ((VALID_USER_STATUSES as ReadonlySet<string>).has(raw)) return raw as SessionUserStatus;
  return 'wip';
}

function toState(kind: TurnState['kind'], payload: string): TurnState {
  const data = JSON.parse(payload) as Record<string, unknown>;
  return { kind, ...data } as TurnState;
}

const VALID_PROVIDER_IDS: ReadonlySet<string> = new Set(['anthropic', 'cursor', 'codex']);

const VALID_PERMISSION_MODES: ReadonlySet<string> = new Set([
  'default',
  'acceptEdits',
  'bypassPermissions',
  'dontAsk',
  'plan',
]);

function toPermissionMode(raw: string | null): ClaudePermissionMode {
  if (raw !== null && VALID_PERMISSION_MODES.has(raw)) return raw as ClaudePermissionMode;
  return 'bypassPermissions';
}

function toProviderPreference(row: SessionRow): SessionProviderPreference {
  const defaultProvider: ProviderId = VALID_PROVIDER_IDS.has(row.provider_default)
    ? (row.provider_default as ProviderId)
    : 'anthropic';
  return {
    defaultProvider,
    allowTurnOverride: row.provider_allow_override !== 0,
  };
}

function toDomain(row: SessionRow, contextSlots: Session['contextSlots']): Session {
  return {
    id: row.id as SessionId,
    workspaceId: row.workspace_id as WorkspaceId,
    goal: row.goal,
    state: toState(row.state_kind, row.state_payload),
    contextSlots,
    providerPreference: toProviderPreference(row),
    permissionMode: toPermissionMode(row.permission_mode),
    ...(row.workflow_id && { workflowId: row.workflow_id as WorkflowId }),
    ...(row.current_step_ordinal !== null && { currentStepOrdinal: row.current_step_ordinal }),
    autoRun: row.auto_run !== 0,
    titleUserEdited: row.title_user_edited !== 0,
    ...(row.archived_at != null && {
      archivedAt: new Date(row.archived_at).toISOString() as IsoDateTime,
    }),
    ...(row.deleted_at != null && {
      deletedAt: new Date(row.deleted_at).toISOString() as IsoDateTime,
    }),
    ...(row.verbosity && { verbosity: row.verbosity as 'brief' | 'normal' | 'verbose' }),
    ...(row.effort && {
      effort: row.effort as 'low' | 'medium' | 'high' | 'extra-high' | 'max',
    }),
    ...(row.model_override && { modelOverride: row.model_override }),
    ...(row.provider_override && { providerOverride: row.provider_override }),
    userStatus: toUserStatus(row.user_status),
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  };
}

export interface SessionConfigUpdate {
  verbosity?: 'brief' | 'normal' | 'verbose' | null;
  effort?: 'low' | 'medium' | 'high' | 'extra-high' | 'max' | null;
  modelOverride?: string | null;
  providerOverride?: string | null;
}

export async function updateSessionConfig(
  db: Database,
  id: SessionId,
  fields: SessionConfigUpdate,
): Promise<void> {
  const updates: string[] = [];
  const values: unknown[] = [];
  if (fields.verbosity !== undefined) {
    updates.push('verbosity = ?');
    values.push(fields.verbosity);
  }
  if (fields.effort !== undefined) {
    updates.push('effort = ?');
    values.push(fields.effort);
  }
  if (fields.modelOverride !== undefined) {
    updates.push('model_override = ?');
    values.push(fields.modelOverride);
  }
  if (fields.providerOverride !== undefined) {
    updates.push('provider_override = ?');
    values.push(fields.providerOverride);
  }
  if (updates.length === 0) return;
  values.push(id);
  await db.execute(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`, values);
}

function splitState(state: TurnState): { kind: TurnState['kind']; payload: string } {
  const { kind, ...rest } = state;
  return { kind, payload: JSON.stringify(rest) };
}

export async function insertSession(db: Database, session: Session): Promise<void> {
  const { kind, payload } = splitState(session.state);
  await db.execute(
    `INSERT INTO sessions
      (id, workspace_id, goal, state_kind, state_payload, provider_default, provider_allow_override, permission_mode, workflow_id, current_step_ordinal, auto_run, title_user_edited, user_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.workspaceId,
      session.goal,
      kind,
      payload,
      session.providerPreference.defaultProvider,
      session.providerPreference.allowTurnOverride ? 1 : 0,
      session.permissionMode,
      session.workflowId ?? null,
      session.currentStepOrdinal ?? null,
      session.autoRun ? 1 : 0,
      session.titleUserEdited ? 1 : 0,
      session.userStatus,
      Date.parse(session.createdAt),
      Date.parse(session.updatedAt),
    ],
  );
}

export async function updateSessionAutoRun(
  db: Database,
  id: SessionId,
  autoRun: boolean,
  updatedAt: IsoDateTime,
): Promise<void> {
  await db.execute('UPDATE sessions SET auto_run = ?, updated_at = ? WHERE id = ?', [
    autoRun ? 1 : 0,
    Date.parse(updatedAt),
    id,
  ]);
}

export async function updateSessionWorkflow(
  db: Database,
  id: SessionId,
  workflowId: WorkflowId | null,
  autoRun: boolean,
  updatedAt: IsoDateTime,
): Promise<void> {
  await db.execute(
    'UPDATE sessions SET workflow_id = ?, auto_run = ?, updated_at = ? WHERE id = ?',
    [workflowId, autoRun ? 1 : 0, Date.parse(updatedAt), id],
  );
}

export async function updateSessionUserStatus(
  db: Database,
  id: SessionId,
  status: SessionUserStatus,
  updatedAt: IsoDateTime,
): Promise<void> {
  await db.execute('UPDATE sessions SET user_status = ?, updated_at = ? WHERE id = ?', [
    status,
    Date.parse(updatedAt),
    id,
  ]);
}

export async function updateSessionTitleUserEdited(
  db: Database,
  id: SessionId,
  titleUserEdited: boolean,
  updatedAt: IsoDateTime,
): Promise<void> {
  await db.execute('UPDATE sessions SET title_user_edited = ?, updated_at = ? WHERE id = ?', [
    titleUserEdited ? 1 : 0,
    Date.parse(updatedAt),
    id,
  ]);
}

export async function updateSessionState(
  db: Database,
  id: SessionId,
  state: TurnState,
  updatedAt: IsoDateTime,
): Promise<void> {
  const { kind, payload } = splitState(state);
  await db.execute(
    'UPDATE sessions SET state_kind = ?, state_payload = ?, updated_at = ? WHERE id = ?',
    [kind, payload, Date.parse(updatedAt), id],
  );
}

export async function updateSessionPermissionMode(
  db: Database,
  id: SessionId,
  permissionMode: ClaudePermissionMode,
  updatedAt: IsoDateTime,
): Promise<void> {
  await db.execute('UPDATE sessions SET permission_mode = ?, updated_at = ? WHERE id = ?', [
    permissionMode,
    Date.parse(updatedAt),
    id,
  ]);
}

export async function getSessionById(db: Database, id: SessionId): Promise<Session | null> {
  const rows = await db.select<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id]);
  const row = rows[0];
  if (!row) return null;
  return toDomain(row, []);
}

export async function listSessionsForWorkspace(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<Session>> {
  const rows = await db.select<SessionRow>(
    'SELECT * FROM sessions WHERE workspace_id = ? ORDER BY updated_at DESC',
    [workspaceId],
  );
  return rows.map((row) => toDomain(row, []));
}

export async function renameSession(
  db: Database,
  id: SessionId,
  goal: string,
  updatedAt: IsoDateTime,
  titleUserEdited = true,
): Promise<void> {
  await db.execute(
    'UPDATE sessions SET goal = ?, title_user_edited = ?, updated_at = ? WHERE id = ?',
    [goal, titleUserEdited ? 1 : 0, Date.parse(updatedAt), id],
  );
}

export async function deleteSession(db: Database, id: SessionId): Promise<void> {
  await db.execute('DELETE FROM sessions WHERE id = ?', [id]);
}

export async function softDeleteSession(db: Database, id: SessionId): Promise<void> {
  await db.execute('UPDATE sessions SET deleted_at = ? WHERE id = ?', [Date.now(), id]);
}

export async function restoreSession(db: Database, id: SessionId): Promise<void> {
  await db.execute('UPDATE sessions SET deleted_at = NULL WHERE id = ?', [id]);
}

export async function archiveSession(db: Database, id: SessionId): Promise<void> {
  await db.execute('UPDATE sessions SET archived_at = ? WHERE id = ?', [Date.now(), id]);
}

export async function unarchiveSession(db: Database, id: SessionId): Promise<void> {
  await db.execute('UPDATE sessions SET archived_at = NULL WHERE id = ?', [id]);
}
