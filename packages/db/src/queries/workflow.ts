import type {
  AgentEffort,
  IsoDateTime,
  ProviderId,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@kay-am/types';
import type { Database } from '../client';

interface WorkflowRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface StepRow {
  id: string;
  workflow_id: string;
  ordinal: number;
  name: string;
  prompt_prefix: string;
  provider_override: string | null;
  model_override: string | null;
  effort: string | null;
}

function toStep(row: StepRow): Step {
  return {
    id: row.id as StepId,
    workflowId: row.workflow_id as WorkflowId,
    ordinal: row.ordinal,
    name: row.name,
    promptPrefix: row.prompt_prefix,
    ...(row.provider_override && { providerOverride: row.provider_override as ProviderId }),
    ...(row.model_override && { modelOverride: row.model_override }),
    ...(row.effort && { effort: row.effort as AgentEffort }),
  };
}

function toWorkflow(row: WorkflowRow, steps: ReadonlyArray<Step>): Workflow {
  return {
    id: row.id as WorkflowId,
    workspaceId: row.workspace_id as WorkspaceId,
    name: row.name,
    description: row.description,
    steps,
    createdAt: row.created_at as IsoDateTime,
    updatedAt: row.updated_at as IsoDateTime,
  };
}

export async function listWorkflows(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<Workflow>> {
  const rows = await db.select<WorkflowRow>(
    'SELECT * FROM workflows WHERE workspace_id = ? ORDER BY created_at ASC',
    [workspaceId],
  );

  const workflows: Workflow[] = [];
  for (const row of rows) {
    const stepRows = await db.select<StepRow>(
      'SELECT * FROM steps WHERE workflow_id = ? ORDER BY ordinal ASC',
      [row.id],
    );
    workflows.push(toWorkflow(row, stepRows.map(toStep)));
  }

  return workflows;
}

export async function getWorkflow(db: Database, id: WorkflowId): Promise<Workflow | null> {
  const rows = await db.select<WorkflowRow>('SELECT * FROM workflows WHERE id = ?', [id]);
  const row = rows[0];
  if (!row) return null;

  const stepRows = await db.select<StepRow>(
    'SELECT * FROM steps WHERE workflow_id = ? ORDER BY ordinal ASC',
    [row.id],
  );

  return toWorkflow(row, stepRows.map(toStep));
}

export async function upsertWorkflow(db: Database, workflow: Workflow): Promise<void> {
  await db.execute(
    `INSERT INTO workflows
      (id, workspace_id, name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       updated_at = excluded.updated_at`,
    [
      workflow.id,
      workflow.workspaceId,
      workflow.name,
      workflow.description,
      workflow.createdAt,
      workflow.updatedAt,
    ],
  );

  await db.execute('DELETE FROM steps WHERE workflow_id = ?', [workflow.id]);
  for (const step of workflow.steps) {
    await db.execute(
      `INSERT INTO steps
        (id, workflow_id, ordinal, name, prompt_prefix, provider_override, model_override, effort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        step.id,
        workflow.id,
        step.ordinal,
        step.name,
        step.promptPrefix,
        step.providerOverride ?? null,
        step.modelOverride ?? null,
        step.effort ?? null,
      ],
    );
  }
}

export async function deleteWorkflow(db: Database, id: WorkflowId): Promise<void> {
  await db.execute('DELETE FROM workflows WHERE id = ?', [id]);
}
