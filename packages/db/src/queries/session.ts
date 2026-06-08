import type {
  ClaudePermissionMode,
  IsoDateTime,
  ModelEffort,
  ProviderId,
  Session,
  SessionId,
  SessionProviderPreference,
  SessionUserStatus,
  TurnState,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';

interface SessionWorkflowRow {
  workflow_run_id: string;
  workflow_id: string;
  ordinal: number;
  current_step_ordinal: number;
  auto_run: number;
  discarded_at: string | null;
}

function toWorkflowRun(row: SessionWorkflowRow): WorkflowRun {
  return {
    id: row.workflow_run_id as WorkflowRunId,
    workflowId: row.workflow_id as WorkflowId,
    ordinal: row.ordinal,
    currentStep: row.current_step_ordinal,
    autoRun: row.auto_run !== 0,
    ...(row.discarded_at != null && { discardedAt: row.discarded_at as IsoDateTime }),
  };
}

interface SessionRow {
  id: string;
  workspace_id: string;
  goal: string;
  state_kind: TurnState['kind'];
  state_payload: string;
  provider_default: string;
  provider_allow_override: number;
  permission_mode: string | null;
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

function toDomain(
  row: SessionRow,
  contextSlots: Session['contextSlots'],
  workflowRuns: ReadonlyArray<WorkflowRun> = [],
): Session {
  return {
    id: row.id as SessionId,
    workspaceId: row.workspace_id as WorkspaceId,
    goal: row.goal,
    state: toState(row.state_kind, row.state_payload),
    contextSlots,
    providerPreference: toProviderPreference(row),
    permissionMode: toPermissionMode(row.permission_mode),
    workflowRuns,
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
      effort: row.effort as ModelEffort,
    }),
    ...(row.model_override && { modelOverride: row.model_override }),
    ...(row.provider_override && { providerOverride: row.provider_override }),
    userStatus: toUserStatus(row.user_status),
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  };
}

async function loadWorkflowsForSession(
  db: Database,
  sessionId: string,
): Promise<ReadonlyArray<WorkflowRun>> {
  const rows = await db.select<SessionWorkflowRow>(
    'SELECT workflow_run_id, workflow_id, ordinal, current_step_ordinal, auto_run, discarded_at FROM session_workflows WHERE session_id = ? ORDER BY ordinal ASC',
    [sessionId],
  );
  return rows.map(toWorkflowRun);
}

export interface SessionConfigUpdate {
  verbosity?: 'brief' | 'normal' | 'verbose' | null;
  effort?: ModelEffort | null;
  modelOverride?: string | null;
  providerOverride?: string | null;
  /** Session-level default provider. New agents/workflows spawned in this
   *  session inherit it. Distinct from `providerOverride`, which is the
   *  ephemeral per-turn pick from the chat composer. */
  defaultProvider?: ProviderId | null;
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
  if (fields.defaultProvider !== undefined && fields.defaultProvider !== null) {
    updates.push('provider_default = ?');
    values.push(fields.defaultProvider);
    // Changing the session-level default clears any stale per-turn override so
    // future agents inherit the new default instead of the old override.
    updates.push('provider_override = ?');
    values.push(null);
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
      (id, workspace_id, goal, state_kind, state_payload, provider_default, provider_allow_override, permission_mode, auto_run, title_user_edited, user_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.workspaceId,
      session.goal,
      kind,
      payload,
      session.providerPreference.defaultProvider,
      session.providerPreference.allowTurnOverride ? 1 : 0,
      session.permissionMode,
      session.autoRun ? 1 : 0,
      session.titleUserEdited ? 1 : 0,
      session.userStatus,
      Date.parse(session.createdAt),
      Date.parse(session.updatedAt),
    ],
  );
  for (const run of session.workflowRuns) {
    await db.execute(
      'INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, discarded_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        run.id,
        session.id,
        run.workflowId,
        run.ordinal,
        run.currentStep,
        run.autoRun ? 1 : 0,
        run.discardedAt ?? null,
      ],
    );
  }
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
  const workflowRuns = await loadWorkflowsForSession(db, id);
  return toDomain(row, [], workflowRuns);
}

async function hydrateSessions(
  db: Database,
  rows: ReadonlyArray<SessionRow>,
): Promise<ReadonlyArray<Session>> {
  if (rows.length === 0) return [];
  const sessionIds = rows.map((r) => r.id);
  const placeholders = sessionIds.map(() => '?').join(', ');
  const workflowRows = await db.select<SessionWorkflowRow & { session_id: string }>(
    `SELECT session_id, workflow_run_id, workflow_id, ordinal, current_step_ordinal, auto_run, discarded_at FROM session_workflows WHERE session_id IN (${placeholders}) ORDER BY session_id, ordinal ASC`,
    sessionIds,
  );

  const runsBySession = new Map<string, WorkflowRun[]>();
  for (const r of workflowRows) {
    const arr = runsBySession.get(r.session_id) ?? [];
    arr.push(toWorkflowRun(r));
    runsBySession.set(r.session_id, arr);
  }

  return rows.map((row) => toDomain(row, [], runsBySession.get(row.id) ?? []));
}

// Active sessions only — archived rows are returned by
// `listArchivedSessionsForWorkspace` and live in a separate, lazily-loaded
// slice of the store. The split keeps archived sessions out of every
// interactive surface (palette, github polling, unread, eager loads) by
// construction; they exist purely as historical info under the Archived tab.
export async function listSessionsForWorkspace(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<Session>> {
  const rows = await db.select<SessionRow>(
    'SELECT * FROM sessions WHERE workspace_id = ? AND archived_at IS NULL AND deleted_at IS NULL ORDER BY updated_at DESC',
    [workspaceId],
  );
  return hydrateSessions(db, rows);
}

// Archived sessions for a workspace, sorted by archival time. Loaded lazily
// when the Archived tab is opened — never participates in palette search,
// github polling, unread dots, or workspace-switch eager loads.
export async function listArchivedSessionsForWorkspace(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<Session>> {
  const rows = await db.select<SessionRow>(
    'SELECT * FROM sessions WHERE workspace_id = ? AND archived_at IS NOT NULL AND deleted_at IS NULL ORDER BY archived_at DESC',
    [workspaceId],
  );
  return hydrateSessions(db, rows);
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
