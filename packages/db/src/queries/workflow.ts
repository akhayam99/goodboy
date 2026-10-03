import type {
  AgentEffort,
  AgentRole,
  IsoDateTime,
  ProviderId,
  Step,
  StepDefId,
  StepId,
  StepSize,
  VerbosityLevel,
  Workflow,
  WorkflowId,
  WorkflowOrigin,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowTaskProfile,
  WorkspaceId,
} from '@goodboy/types';
import { isStepSize, isWorkflowOrigin } from '@goodboy/types';
import type { Database, GuardedStatement, PlainStatement, TransactionOutcome } from '../client';
import { NotFoundError, UniqueViolationError } from '../shared/errors';
import {
  isWorkflowRoutingDecision,
  isWorkflowRoutingLock,
  isWorkflowTaskProfile,
  legacyStepRoutingLock,
  parseWorkflowRouting,
  stringifyRoutingJson,
} from './workflowRoutingCodec';

type WorkflowRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  goal: string | null;
  process_text: string | null;
  created_at: number;
  updated_at: number;
  is_preset: number | null;
  origin: string | null;
  deleted_at: number | null;
};

type StepRow = {
  id: string;
  workflow_id: string;
  library_step_id: string | null;
  role: string | null;
  ordinal: number;
  name: string;
  prompt_prefix: string;
  expected_output: string | null;
  provider_override: string | null;
  model_override: string | null;
  effort: string | null;
  verbosity: string | null;
  orchestrator_reason: string | null;
  routing_lock: string | null;
  routing_decision: string | null;
  task_profile: string | null;
  size: string | null;
};

function toStep(row: StepRow): Step {
  const routing = parseWorkflowRouting({
    routingLock: row.routing_lock,
    routingDecision: row.routing_decision,
    taskProfile: row.task_profile,
  });
  const routingLock =
    routing.routingLock ??
    (routing.routingDecision === null
      ? legacyStepRoutingLock({
          provider: row.provider_override,
          model: row.model_override,
          effort: row.effort,
        })
      : null);
  return {
    id: row.id as StepId,
    workflowId: row.workflow_id as WorkflowId,
    ordinal: row.ordinal,
    name: row.name,
    promptPrefix: row.prompt_prefix,
    ...(row.expected_output != null &&
      row.expected_output !== '' && { expectedOutput: row.expected_output }),
    ...(row.library_step_id && { libraryStepId: row.library_step_id as StepDefId }),
    ...(row.role && { role: row.role as AgentRole }),
    ...(row.provider_override && { providerOverride: row.provider_override as ProviderId }),
    ...(row.model_override && { modelOverride: row.model_override }),
    ...(row.effort && { effort: row.effort as AgentEffort }),
    ...(row.verbosity && { verbosity: row.verbosity as VerbosityLevel }),
    ...(row.orchestrator_reason != null &&
      row.orchestrator_reason !== '' && { orchestratorReason: row.orchestrator_reason }),
    routingLock,
    routingDecision: routing.routingDecision,
    taskProfile: routing.taskProfile,
    ...(isStepSize(row.size) && { size: row.size }),
  };
}

function toWorkflow(row: WorkflowRow, steps: ReadonlyArray<Step>): Workflow {
  return {
    id: row.id as WorkflowId,
    workspaceId: row.workspace_id as WorkspaceId,
    name: row.name,
    description: row.description,
    ...(row.goal != null && { goal: row.goal }),
    ...(row.process_text != null && row.process_text !== '' && { processText: row.process_text }),
    steps,
    isPreset: row.is_preset == null ? true : row.is_preset !== 0,
    ...(isWorkflowOrigin(row.origin) && { origin: row.origin }),
    ...(row.deleted_at != null && {
      deletedAt: new Date(row.deleted_at).toISOString() as IsoDateTime,
    }),
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  };
}

export const listWorkflows = async (
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<Workflow>> => {
  const rows = await db.select<WorkflowRow>(
    'SELECT * FROM workflows WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY created_at ASC',
    [workspaceId],
  );

  if (rows.length === 0) {
    return [];
  }
  const workflowIds = rows.map((row) => row.id);
  const stepRows = await db.select<StepRow>(
    `SELECT * FROM steps
     WHERE workflow_id IN (${workflowIds.map(() => '?').join(', ')}) AND deleted_at IS NULL
     ORDER BY workflow_id, ordinal ASC`,
    workflowIds,
  );
  const stepsByWorkflow = new Map<string, Step[]>();
  for (const stepRow of stepRows) {
    const bucket = stepsByWorkflow.get(stepRow.workflow_id) ?? [];
    bucket.push(toStep(stepRow));
    stepsByWorkflow.set(stepRow.workflow_id, bucket);
  }
  return rows.map((row) => toWorkflow(row, stepsByWorkflow.get(row.id) ?? []));
};

type ListWorkflowsIncludingDeletedParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

export const listWorkflowsIncludingDeleted = async ({
  db,
  workspaceId,
}: ListWorkflowsIncludingDeletedParams): Promise<ReadonlyArray<Workflow>> => {
  const rows = await db.select<WorkflowRow>(
    'SELECT * FROM workflows WHERE workspace_id = ? ORDER BY created_at ASC',
    [workspaceId],
  );
  if (rows.length === 0) {
    return [];
  }
  const workflowIds = rows.map((row) => row.id);
  const stepRows = await db.select<StepRow>(
    `SELECT * FROM steps
     WHERE workflow_id IN (${workflowIds.map(() => '?').join(', ')}) AND deleted_at IS NULL
     ORDER BY workflow_id, ordinal ASC`,
    workflowIds,
  );
  const stepsByWorkflow = new Map<string, Step[]>();
  for (const stepRow of stepRows) {
    const bucket = stepsByWorkflow.get(stepRow.workflow_id) ?? [];
    bucket.push(toStep(stepRow));
    stepsByWorkflow.set(stepRow.workflow_id, bucket);
  }
  return rows.map((row) => toWorkflow(row, stepsByWorkflow.get(row.id) ?? []));
};

export const getWorkflow = async (db: Database, id: WorkflowId): Promise<Workflow | null> => {
  const rows = await db.select<WorkflowRow>('SELECT * FROM workflows WHERE id = ?', [id]);
  const row = rows[0];
  if (!row) {
    return null;
  }

  const stepRows = await db.select<StepRow>(
    'SELECT * FROM steps WHERE workflow_id = ? AND deleted_at IS NULL ORDER BY ordinal ASC',
    [row.id],
  );

  return toWorkflow(row, stepRows.map(toStep));
};

const STEP_UPSERT_SQL = `INSERT INTO steps
    (id, workflow_id, library_step_id, role, ordinal, name, prompt_prefix, expected_output,
     provider_override, model_override, effort, verbosity,
     orchestrator_reason, routing_lock, routing_decision, task_profile, size, deleted_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
   ON CONFLICT(id) DO UPDATE SET
     workflow_id      = excluded.workflow_id,
     library_step_id  = excluded.library_step_id,
     role             = excluded.role,
     ordinal          = excluded.ordinal,
     name             = excluded.name,
     prompt_prefix    = excluded.prompt_prefix,
     expected_output  = excluded.expected_output,
     provider_override = excluded.provider_override,
     model_override   = excluded.model_override,
     effort           = excluded.effort,
     verbosity        = excluded.verbosity,
     orchestrator_reason = excluded.orchestrator_reason,
     routing_lock     = excluded.routing_lock,
     routing_decision = excluded.routing_decision,
     task_profile     = excluded.task_profile,
     size             = excluded.size,
     deleted_at       = NULL`;

const upsertStatements = (workflow: Workflow): ReadonlyArray<PlainStatement> => {
  const stepStatements = workflow.steps.map((step): PlainStatement => ({
    sql: STEP_UPSERT_SQL,
    params: [
      step.id,
      workflow.id,
      step.libraryStepId ?? null,
      step.role ?? null,
      step.ordinal,
      step.name,
      step.promptPrefix,
      step.expectedOutput ?? null,
      step.providerOverride ?? null,
      step.modelOverride ?? null,
      step.effort ?? null,
      step.verbosity ?? null,
      step.orchestratorReason ?? null,
      stringifyRoutingJson({
        value: step.routingLock ?? null,
        isValid: isWorkflowRoutingLock,
        field: 'routing lock',
      }),
      stringifyRoutingJson({
        value: step.routingDecision ?? null,
        isValid: isWorkflowRoutingDecision,
        field: 'routing decision',
      }),
      stringifyRoutingJson({
        value: step.taskProfile ?? null,
        isValid: isWorkflowTaskProfile,
        field: 'task profile',
      }),
      step.size ?? null,
    ],
  }));
  const workflowStatement: PlainStatement = {
    sql: `INSERT INTO workflows
      (id, workspace_id, name, description, goal, process_text, created_at, updated_at, is_preset,
       origin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       goal = excluded.goal,
       process_text = excluded.process_text,
       updated_at = excluded.updated_at,
       is_preset = excluded.is_preset,
       origin = COALESCE(workflows.origin, excluded.origin)`,
    params: [
      workflow.id,
      workflow.workspaceId,
      workflow.name,
      workflow.description,
      workflow.goal ?? null,
      workflow.processText ?? null,
      Date.parse(workflow.createdAt),
      Date.parse(workflow.updatedAt),
      workflow.isPreset === false ? 0 : 1,
      workflow.origin ?? null,
    ],
  };
  return [workflowStatement, ...stepStatements];
};

export const upsertWorkflow = async (db: Database, workflow: Workflow): Promise<void> => {
  await db.transaction({ statements: upsertStatements(workflow) });
};

const NAME_TAKEN = 'name_taken';

const freeNameGuard = (workflow: Workflow): GuardedStatement => ({
  sql: `SELECT 1 AS present FROM workflows
    WHERE workspace_id = ? AND name = ? AND id <> ? AND deleted_at IS NULL AND is_preset = 1`,
  params: [workflow.workspaceId, workflow.name, workflow.id],
  abortWhen: 'rows',
  abortCode: NAME_TAKEN,
});

type WriteWorkflowParams = {
  readonly db: Database;
  readonly workflow: Workflow;
  readonly guardName: boolean;
  readonly guards?: ReadonlyArray<GuardedStatement>;
};

const writeWorkflow = async ({
  db,
  workflow,
  guardName,
  guards = [],
}: WriteWorkflowParams): Promise<TransactionOutcome> => {
  const deletedAt = Date.now();
  const keptIds = workflow.steps.map((step) => step.id);
  const keptPlaceholders = keptIds.length === 0 ? "''" : keptIds.map(() => '?').join(', ');
  const outcome = await db.transaction({
    statements: [
      ...guards,
      ...(guardName ? [freeNameGuard(workflow)] : []),
      ...upsertStatements(workflow),
      { sql: 'UPDATE workflows SET deleted_at = NULL WHERE id = ?', params: [workflow.id] },
      {
        sql: `UPDATE steps SET deleted_at = ?
         WHERE workflow_id = ? AND deleted_at IS NULL AND id NOT IN (${keptPlaceholders})`,
        params: [deletedAt, workflow.id, ...keptIds],
      },
    ],
  });
  return outcome;
};

const WORKFLOW_RUNNING = 'workflow_running';

const ACTIVE_RUN_PREDICATE = `sw.discarded_at IS NULL
      AND NOT (
        (sw.orchestration_stop_kind = 'closed' AND sw.orchestration_error IS NOT NULL)
        OR (
          sw.execution_mode = 'dynamic'
          AND sw.orchestration_outcome = 'done'
          AND NOT EXISTS (
            SELECT 1 FROM live_agents child
            WHERE child.workflow_run_id = sw.workflow_run_id
              AND child.parent_agent_id IS NOT NULL
              AND child.status NOT IN ('completed', 'skipped')
          )
        )
        OR (
          sw.execution_mode <> 'dynamic'
          AND NOT EXISTS (
            SELECT 1 FROM steps st
            WHERE st.workflow_id = sw.workflow_id AND st.deleted_at IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM live_agents agent
                WHERE agent.workflow_run_id = sw.workflow_run_id
                  AND agent.step_id = st.id
                  AND agent.parent_agent_id IS NULL
                  AND agent.status IN ('completed', 'skipped')
              )
          )
          AND NOT EXISTS (
            SELECT 1 FROM live_agents child
            WHERE child.workflow_run_id = sw.workflow_run_id
              AND child.parent_agent_id IS NOT NULL
              AND child.status NOT IN ('completed', 'skipped')
          )
        )
      )`;

type ActiveRunGuardParams = {
  readonly workflowId: WorkflowId;
};

const activeRunGuard = ({ workflowId }: ActiveRunGuardParams): GuardedStatement => ({
  sql: `SELECT 1 AS present FROM session_workflows sw
    WHERE sw.workflow_id = ? AND ${ACTIVE_RUN_PREDICATE}
    LIMIT 1`,
  params: [workflowId],
  abortWhen: 'rows',
  abortCode: WORKFLOW_RUNNING,
});

export type RestoreSeededWorkflowResult = 'restored' | 'name_taken' | 'workflow_running';

type RestoreSeededWorkflowParams = {
  readonly db: Database;
  readonly workflow: Workflow;
};

export const restoreSeededWorkflow = async ({
  db,
  workflow,
}: RestoreSeededWorkflowParams): Promise<RestoreSeededWorkflowResult> => {
  const outcome = await writeWorkflow({
    db,
    workflow,
    guardName: true,
    guards: [activeRunGuard({ workflowId: workflow.id })],
  });
  if (outcome.status === 'committed') {
    return 'restored';
  }
  return outcome.abortCode === WORKFLOW_RUNNING ? 'workflow_running' : 'name_taken';
};

type ActiveWorkflowRunRow = {
  readonly session_title: string;
};

type FindActiveWorkflowRunTitleParams = {
  readonly db: Database;
  readonly workflowId: WorkflowId;
};

export const findActiveWorkflowRunTitle = async ({
  db,
  workflowId,
}: FindActiveWorkflowRunTitleParams): Promise<string | null> => {
  const rows = await db.select<ActiveWorkflowRunRow>(
    `SELECT sessions.goal AS session_title FROM session_workflows sw
     JOIN sessions ON sessions.id = sw.session_id
     WHERE sw.workflow_id = ? AND ${ACTIVE_RUN_PREDICATE}
     ORDER BY sw.ordinal ASC LIMIT 1`,
    [workflowId],
  );
  return rows[0]?.session_title ?? null;
};

export type WorkflowStepInput = {
  readonly id?: StepId;
  readonly libraryStepId?: StepDefId;
  readonly role?: AgentRole;
  readonly ordinal: number;
  readonly name: string;
  readonly promptPrefix: string;
  readonly expectedOutput?: string;
  readonly providerOverride?: ProviderId;
  readonly modelOverride?: string;
  readonly effort?: AgentEffort;
  readonly verbosity?: VerbosityLevel;
  readonly orchestratorReason?: string;
  readonly routingLock?: WorkflowRoutingLock | null;
  readonly routingDecision?: WorkflowRoutingDecision | null;
  readonly taskProfile?: WorkflowTaskProfile | null;
  readonly size?: StepSize;
};

export type SaveWorkflowInput = {
  readonly id?: WorkflowId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly description: string;
  readonly goal?: string;
  readonly processText?: string;
  readonly steps: ReadonlyArray<WorkflowStepInput>;
  readonly isPreset?: boolean;
  readonly origin?: WorkflowOrigin;
};

type TemplateNameRow = {
  readonly name: string;
};

type LiveNamesParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly excludeId: string;
};

const liveTemplateNames = async ({
  db,
  workspaceId,
  excludeId,
}: LiveNamesParams): Promise<ReadonlySet<string>> => {
  const rows = await db.select<TemplateNameRow>(
    `SELECT name FROM workflows
     WHERE workspace_id = ? AND id <> ? AND deleted_at IS NULL AND is_preset = 1`,
    [workspaceId, excludeId],
  );
  return new Set(rows.map((row) => row.name));
};

type ResolveNameParams = LiveNamesParams & {
  readonly requested: string;
  readonly isPreset: boolean;
};

export const resolveLiveWorkflowName = async ({
  requested,
  isPreset,
  ...lookup
}: ResolveNameParams): Promise<string> => {
  if (!isPreset) {
    return requested;
  }
  const taken = await liveTemplateNames(lookup);
  if (!taken.has(requested)) {
    return requested;
  }
  let suffix = 2;
  while (taken.has(`${requested} ${suffix}`)) {
    suffix += 1;
  }
  return `${requested} ${suffix}`;
};

const findLiveTemplateId = async (
  db: Database,
  input: SaveWorkflowInput,
): Promise<WorkflowId | null> => {
  const rows = await db.select<IdRow>(
    `SELECT id FROM workflows
     WHERE workspace_id = ? AND name = ? AND deleted_at IS NULL AND is_preset = 1
     LIMIT 1`,
    [input.workspaceId, input.name],
  );
  const row = rows[0];
  return row === undefined ? null : (row.id as WorkflowId);
};

const isoOf = (ms: number): IsoDateTime => new Date(ms).toISOString() as IsoDateTime;

const stepFromInput = (input: WorkflowStepInput, workflowId: WorkflowId): Step => ({
  id: input.id ?? (crypto.randomUUID() as StepId),
  workflowId,
  ordinal: input.ordinal,
  name: input.name,
  promptPrefix: input.promptPrefix,
  ...(input.libraryStepId !== undefined && { libraryStepId: input.libraryStepId }),
  ...(input.role !== undefined && { role: input.role }),
  ...(input.expectedOutput !== undefined && { expectedOutput: input.expectedOutput }),
  ...(input.providerOverride !== undefined && { providerOverride: input.providerOverride }),
  ...(input.modelOverride !== undefined && { modelOverride: input.modelOverride }),
  ...(input.effort !== undefined && { effort: input.effort }),
  ...(input.verbosity !== undefined && { verbosity: input.verbosity }),
  ...(input.orchestratorReason !== undefined && { orchestratorReason: input.orchestratorReason }),
  routingLock: input.routingLock ?? null,
  routingDecision: input.routingDecision ?? null,
  taskProfile: input.taskProfile ?? null,
  ...(isStepSize(input.size) && { size: input.size }),
});

const MAX_NAME_ATTEMPTS = 5;

const draftWorkflow = async (db: Database, input: SaveWorkflowInput): Promise<Workflow> => {
  const nowMs = Date.now();
  const isPreset = input.isPreset ?? true;
  const id =
    input.id ?? (await findLiveTemplateId(db, input)) ?? (crypto.randomUUID() as WorkflowId);
  const name = await resolveLiveWorkflowName({
    db,
    workspaceId: input.workspaceId,
    excludeId: id,
    requested: input.name,
    isPreset,
  });
  return {
    id,
    workspaceId: input.workspaceId,
    name,
    description: input.description,
    ...(input.goal !== undefined && { goal: input.goal }),
    ...(input.processText !== undefined && { processText: input.processText }),
    steps: input.steps.map((step) => stepFromInput(step, id)),
    isPreset,
    ...(input.origin !== undefined && { origin: input.origin }),
    createdAt: isoOf(nowMs),
    updatedAt: isoOf(nowMs),
  };
};

export const saveWorkflow = async (db: Database, input: SaveWorkflowInput): Promise<Workflow> => {
  for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt += 1) {
    const workflow = await draftWorkflow(db, input);
    const outcome = await writeWorkflow({ db, workflow, guardName: workflow.isPreset !== false });
    if (outcome.status === 'aborted') {
      continue;
    }
    const saved = await getWorkflow(db, workflow.id);
    if (saved === null) {
      throw new NotFoundError('workflow', workflow.id);
    }
    return saved;
  }
  throw new UniqueViolationError('workflows', 'name');
};

const SEEDED_WORKFLOW_ID = `id LIKE 'wf\\_seed\\_%' ESCAPE '\\'`;

export type BuiltinSeedState = {
  readonly workspaceIds: ReadonlyArray<WorkspaceId>;
  readonly seededIds: ReadonlySet<string>;
  readonly takenNames: ReadonlySet<string>;
};

type IdRow = {
  readonly id: string;
};

type NameRow = {
  readonly workspace_id: string;
  readonly name: string;
};

type TakenNameKeyParams = {
  readonly workspaceId: string;
  readonly name: string;
};

export const takenNameKey = ({ workspaceId, name }: TakenNameKeyParams): string =>
  `${workspaceId}\n${name}`;

export const readBuiltinSeedState = async (db: Database): Promise<BuiltinSeedState> => {
  const workspaces = await db.select<IdRow>('SELECT id FROM workspaces WHERE deleted_at IS NULL');
  const seeded = await db.select<IdRow>(`SELECT id FROM workflows WHERE ${SEEDED_WORKFLOW_ID}`);
  const names = await db.select<NameRow>(
    'SELECT workspace_id, name FROM workflows WHERE deleted_at IS NULL AND is_preset = 1',
  );
  return {
    workspaceIds: workspaces.map((row) => row.id as WorkspaceId),
    seededIds: new Set(seeded.map((row) => row.id)),
    takenNames: new Set(
      names.map((row) => takenNameKey({ workspaceId: row.workspace_id, name: row.name })),
    ),
  };
};

export const listRemovedSeededWorkflowIds = async (
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<WorkflowId>> => {
  const rows = await db.select<IdRow>(
    `SELECT id FROM workflows
     WHERE workspace_id = ? AND ${SEEDED_WORKFLOW_ID} AND deleted_at IS NOT NULL`,
    [workspaceId],
  );
  return rows.map((row) => row.id as WorkflowId);
};

const SEEDED_ID_PREFIX = 'wf_seed_';

export const deleteWorkflow = async (db: Database, id: WorkflowId): Promise<void> => {
  await db.execute('UPDATE workflows SET deleted_at = ? WHERE id = ?', [Date.now(), id]);
};

export const removeWorkflow = async (db: Database, id: WorkflowId): Promise<void> => {
  const rows = await db.select<IdRow>('SELECT id FROM workflows WHERE id = ? LIMIT 1', [id]);
  if (rows.length === 0) {
    throw new NotFoundError('workflow', id);
  }
  if (id.startsWith(SEEDED_ID_PREFIX)) {
    await deleteWorkflow(db, id);
    return;
  }
  const outcome = await db.transaction({
    statements: [
      {
        sql: 'SELECT 1 AS present FROM session_workflows WHERE workflow_id = ? LIMIT 1',
        params: [id],
        abortWhen: 'rows',
        abortCode: 'attached',
      },
      { sql: 'DELETE FROM steps WHERE workflow_id = ?', params: [id] },
      { sql: 'DELETE FROM workflows WHERE id = ?', params: [id] },
    ],
  });
  if (outcome.status === 'aborted') {
    await deleteWorkflow(db, id);
  }
};
