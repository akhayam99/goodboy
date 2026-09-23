import type {
  AgentEffort,
  AgentRole,
  IsoDateTime,
  ProviderId,
  Step,
  StepDefId,
  StepId,
  VerbosityLevel,
  Workflow,
  WorkflowId,
  WorkflowOrigin,
  WorkspaceId,
} from '@goodboy/types';
import { WORKFLOW_ORIGINS } from '@goodboy/types';
import type { Database, PlainStatement } from '../client';
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
  };
}

const isWorkflowOrigin = (value: string | null | undefined): value is WorkflowOrigin =>
  value != null && (WORKFLOW_ORIGINS as ReadonlyArray<string>).includes(value);

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

  const workflows: Workflow[] = [];
  for (const row of rows) {
    const stepRows = await db.select<StepRow>(
      'SELECT * FROM steps WHERE workflow_id = ? AND deleted_at IS NULL ORDER BY ordinal ASC',
      [row.id],
    );
    workflows.push(toWorkflow(row, stepRows.map(toStep)));
  }

  return workflows;
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
     orchestrator_reason, routing_lock, routing_decision, task_profile, deleted_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
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
     deleted_at       = NULL`;

export const upsertWorkflow = async (db: Database, workflow: Workflow): Promise<void> => {
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
  await db.transaction({ statements: [workflowStatement, ...stepStatements] });
};

export const deleteWorkflow = async (db: Database, id: WorkflowId): Promise<void> => {
  await db.execute('UPDATE workflows SET deleted_at = ? WHERE id = ?', [Date.now(), id]);
};
