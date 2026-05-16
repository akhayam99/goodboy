import { invoke } from '@tauri-apps/api/core';
import type {
  IsoDateTime,
  ParallelMergeStrategy,
  ParallelGroup,
  ParallelGroupId,
  Step,
  StepId,
  Session,
  SessionId,
  SessionStatus,
  Workflow,
  WorkflowId,
  ProviderRunId,
  TaskId,
  WorkspaceId,
} from '@kay-am/types';
import type { ProviderId } from '@kay-am/types';

interface RawPhaseDefinitionRow {
  readonly id: string;
  readonly workflowId: string;
  readonly ordinal: number;
  readonly name: string;
  readonly promptPrefix: string;
  readonly providerOverride: string | null;
  readonly modelOverride: string | null;
}

interface RawPhaseTemplateRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly description: string;
  readonly steps: ReadonlyArray<RawPhaseDefinitionRow>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface RawPhaseRunRow {
  readonly id: string;
  readonly taskId: string;
  readonly stepId: string | null;
  readonly ordinal: number;
  readonly name: string;
  readonly status: string;
  readonly providerRunId: string | null;
  readonly outputSummary: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly providerSessionId: string | null;
  readonly lastFinishedAt: string | null;
  readonly lastViewedAt: string | null;
}

function rowToDefinition(row: RawPhaseDefinitionRow): Step {
  return {
    id: row.id as StepId,
    workflowId: row.workflowId as WorkflowId,
    ordinal: row.ordinal,
    name: row.name,
    promptPrefix: row.promptPrefix,
    ...(row.providerOverride != null && { providerOverride: row.providerOverride as ProviderId }),
    ...(row.modelOverride != null && { modelOverride: row.modelOverride }),
  };
}

function rowToTemplate(row: RawPhaseTemplateRow): Workflow {
  return {
    id: row.id as WorkflowId,
    workspaceId: row.workspaceId as WorkspaceId,
    name: row.name,
    description: row.description,
    steps: row.steps.map(rowToDefinition),
    createdAt: row.createdAt as IsoDateTime,
    updatedAt: row.updatedAt as IsoDateTime,
  };
}

function rowToPhaseRun(row: RawPhaseRunRow): Session {
  return {
    id: row.id as SessionId,
    taskId: row.taskId as TaskId,
    ...(row.stepId != null && { stepId: row.stepId as StepId }),
    ordinal: row.ordinal,
    name: row.name,
    status: row.status as SessionStatus,
    ...(row.providerRunId != null && { runId: row.providerRunId as ProviderRunId }),
    ...(row.outputSummary != null && { outputSummary: row.outputSummary }),
    ...(row.startedAt != null && { startedAt: row.startedAt as IsoDateTime }),
    ...(row.completedAt != null && { completedAt: row.completedAt as IsoDateTime }),
    ...(row.providerSessionId != null && { providerSessionId: row.providerSessionId }),
    ...(row.lastFinishedAt != null && { lastFinishedAt: row.lastFinishedAt as IsoDateTime }),
    ...(row.lastViewedAt != null && { lastViewedAt: row.lastViewedAt as IsoDateTime }),
  };
}

// Phase template commands (#155).
export async function invokePhaseTemplateList(workspaceId: WorkspaceId): Promise<Workflow[]> {
  const rows = await invoke<RawPhaseTemplateRow[]>('workflow_list', { workspaceId });
  return rows.map(rowToTemplate);
}

export interface PhaseDefinitionUpsertArgs {
  readonly id?: StepId;
  readonly ordinal: number;
  readonly name: string;
  readonly promptPrefix: string;
  readonly providerOverride?: ProviderId;
  readonly modelOverride?: string;
}

export interface PhaseTemplateUpsertArgs {
  readonly id?: WorkflowId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly description: string;
  readonly steps: ReadonlyArray<PhaseDefinitionUpsertArgs>;
}

export async function invokePhaseTemplateUpsert(args: PhaseTemplateUpsertArgs): Promise<Workflow> {
  const row = await invoke<RawPhaseTemplateRow>('workflow_upsert', {
    input: {
      id: args.id ?? null,
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      steps: args.steps.map((d) => ({
        id: d.id ?? null,
        ordinal: d.ordinal,
        name: d.name,
        promptPrefix: d.promptPrefix,
        providerOverride: d.providerOverride ?? null,
        modelOverride: d.modelOverride ?? null,
      })),
    },
  });
  return rowToTemplate(row);
}

export async function invokePhaseTemplateDelete(id: WorkflowId): Promise<void> {
  return invoke<void>('workflow_delete', { id });
}

// Phase run commands (#156).
export async function invokePhaseRunList(taskId: TaskId): Promise<Session[]> {
  const rows = await invoke<RawPhaseRunRow[]>('session_list_for_task', { taskId });
  return rows.map(rowToPhaseRun);
}

export interface PhaseRunInsertArgs {
  readonly id?: SessionId;
  readonly taskId: TaskId;
  readonly stepId?: StepId;
  readonly ordinal: number;
  readonly name: string;
  readonly status: SessionStatus;
  readonly providerRunId?: ProviderRunId;
  readonly outputSummary?: string;
  readonly startedAt?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
}

export async function invokePhaseRunInsert(run: PhaseRunInsertArgs): Promise<Session> {
  const row = await invoke<RawPhaseRunRow>('session_insert', {
    input: {
      id: run.id ?? null,
      taskId: run.taskId,
      stepId: run.stepId ?? null,
      ordinal: run.ordinal,
      name: run.name,
      status: run.status,
      providerRunId: run.providerRunId ?? null,
      outputSummary: run.outputSummary ?? null,
      startedAt: run.startedAt ?? null,
      completedAt: run.completedAt ?? null,
    },
  });
  return rowToPhaseRun(row);
}

export interface PhaseRunUpdateFields {
  readonly status: SessionStatus;
  readonly providerRunId?: ProviderRunId;
  readonly outputSummary?: string;
  readonly startedAt?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
}

export async function invokePhaseRunUpdateStatus(
  id: SessionId,
  fields: PhaseRunUpdateFields,
): Promise<Session> {
  const row = await invoke<RawPhaseRunRow>('session_update_status', {
    input: {
      id,
      status: fields.status,
      providerRunId: fields.providerRunId ?? null,
      outputSummary: fields.outputSummary ?? null,
      startedAt: fields.startedAt ?? null,
      completedAt: fields.completedAt ?? null,
    },
  });
  return rowToPhaseRun(row);
}

export async function invokeSessionSetProviderSessionId(
  id: SessionId,
  providerSessionId: string,
): Promise<void> {
  await invoke<void>('session_set_provider_session_id', {
    id,
    providerSessionId,
  });
}

export async function invokeSessionMarkViewed(id: SessionId, at: IsoDateTime): Promise<void> {
  await invoke<void>('session_mark_viewed', { id, at });
}

export async function invokeWorkspacesWithUnread(): Promise<ReadonlyArray<WorkspaceId>> {
  const ids = await invoke<string[]>('workspaces_with_unread');
  return ids as ReadonlyArray<string> as ReadonlyArray<WorkspaceId>;
}

// Parallel phase group commands (#207).
interface RawParallelPhaseGroupRow {
  readonly id: string;
  readonly taskId: string;
  readonly ordinal: number;
  readonly mergeStrategy: string;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

function rowToParallelPhaseGroup(row: RawParallelPhaseGroupRow): ParallelGroup {
  return {
    id: row.id as ParallelGroupId,
    taskId: row.taskId as TaskId,
    ordinal: row.ordinal,
    mergeStrategy: row.mergeStrategy as ParallelMergeStrategy,
    createdAt: row.createdAt as IsoDateTime,
    completedAt: row.completedAt != null ? (row.completedAt as IsoDateTime) : null,
  };
}

export interface ParallelPhaseGroupCreateArgs {
  readonly id?: ParallelGroupId;
  readonly taskId: TaskId;
  readonly ordinal: number;
  readonly mergeStrategy: ParallelMergeStrategy;
  readonly createdAt?: IsoDateTime;
}

export async function invokeParallelPhaseGroupCreate(
  args: ParallelPhaseGroupCreateArgs,
): Promise<ParallelGroup> {
  const row = await invoke<RawParallelPhaseGroupRow>('parallel_group_create', {
    input: {
      id: args.id ?? null,
      taskId: args.taskId,
      ordinal: args.ordinal,
      mergeStrategy: args.mergeStrategy,
      createdAt: args.createdAt ?? null,
    },
  });
  return rowToParallelPhaseGroup(row);
}

export async function invokeParallelPhaseGroupUpdateCompletedAt(
  id: ParallelGroupId,
  completedAt: IsoDateTime,
): Promise<ParallelGroup> {
  const row = await invoke<RawParallelPhaseGroupRow>('parallel_group_update_completed_at', {
    id,
    completedAt,
  });
  return rowToParallelPhaseGroup(row);
}
