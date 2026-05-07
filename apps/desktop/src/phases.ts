import { invoke } from '@tauri-apps/api/core';
import type {
  IsoDateTime,
  ParallelMergeStrategy,
  ParallelPhaseGroup,
  ParallelPhaseGroupId,
  PhaseDefinition,
  PhaseDefinitionId,
  PhaseRun,
  PhaseRunId,
  PhaseRunStatus,
  PhaseTemplate,
  PhaseTemplateId,
  ProviderRunId,
  SessionId,
  WorkspaceId,
} from '@kay-am/types';
import type { ProviderId } from '@kay-am/types';

// ---------------------------------------------------------------------------
// Raw row shapes returned by rust commands
// ---------------------------------------------------------------------------

interface RawPhaseDefinitionRow {
  readonly id: string;
  readonly templateId: string;
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
  readonly definitions: ReadonlyArray<RawPhaseDefinitionRow>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface RawPhaseRunRow {
  readonly id: string;
  readonly sessionId: string;
  readonly phaseDefinitionId: string;
  readonly ordinal: number;
  readonly name: string;
  readonly status: string;
  readonly providerRunId: string | null;
  readonly outputSummary: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

// ---------------------------------------------------------------------------
// Row → domain converters
// ---------------------------------------------------------------------------

function rowToDefinition(row: RawPhaseDefinitionRow): PhaseDefinition {
  return {
    id: row.id as PhaseDefinitionId,
    templateId: row.templateId as PhaseTemplateId,
    ordinal: row.ordinal,
    name: row.name,
    promptPrefix: row.promptPrefix,
    ...(row.providerOverride != null && { providerOverride: row.providerOverride as ProviderId }),
    ...(row.modelOverride != null && { modelOverride: row.modelOverride }),
  };
}

function rowToTemplate(row: RawPhaseTemplateRow): PhaseTemplate {
  return {
    id: row.id as PhaseTemplateId,
    workspaceId: row.workspaceId as WorkspaceId,
    name: row.name,
    description: row.description,
    definitions: row.definitions.map(rowToDefinition),
    createdAt: row.createdAt as IsoDateTime,
    updatedAt: row.updatedAt as IsoDateTime,
  };
}

function rowToPhaseRun(row: RawPhaseRunRow): PhaseRun {
  return {
    id: row.id as PhaseRunId,
    sessionId: row.sessionId as SessionId,
    phaseDefinitionId: row.phaseDefinitionId as PhaseDefinitionId,
    ordinal: row.ordinal,
    name: row.name,
    status: row.status as PhaseRunStatus,
    ...(row.providerRunId != null && { runId: row.providerRunId as ProviderRunId }),
    ...(row.outputSummary != null && { outputSummary: row.outputSummary }),
    ...(row.startedAt != null && { startedAt: row.startedAt as IsoDateTime }),
    ...(row.completedAt != null && { completedAt: row.completedAt as IsoDateTime }),
  };
}

// ---------------------------------------------------------------------------
// Phase template commands (#155)
// ---------------------------------------------------------------------------

export async function invokePhaseTemplateList(workspaceId: WorkspaceId): Promise<PhaseTemplate[]> {
  const rows = await invoke<RawPhaseTemplateRow[]>('phase_template_list', { workspaceId });
  return rows.map(rowToTemplate);
}

export async function invokePhaseTemplateGet(id: PhaseTemplateId): Promise<PhaseTemplate | null> {
  const row = await invoke<RawPhaseTemplateRow | null>('phase_template_get', { id });
  return row ? rowToTemplate(row) : null;
}

export interface PhaseDefinitionUpsertArgs {
  readonly id?: PhaseDefinitionId;
  readonly ordinal: number;
  readonly name: string;
  readonly promptPrefix: string;
  readonly providerOverride?: ProviderId;
  readonly modelOverride?: string;
}

export interface PhaseTemplateUpsertArgs {
  readonly id?: PhaseTemplateId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly description: string;
  readonly definitions: ReadonlyArray<PhaseDefinitionUpsertArgs>;
}

export async function invokePhaseTemplateUpsert(
  args: PhaseTemplateUpsertArgs,
): Promise<PhaseTemplate> {
  const row = await invoke<RawPhaseTemplateRow>('phase_template_upsert', {
    input: {
      id: args.id ?? null,
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      definitions: args.definitions.map((d) => ({
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

export async function invokePhaseTemplateDelete(id: PhaseTemplateId): Promise<void> {
  return invoke<void>('phase_template_delete', { id });
}

// ---------------------------------------------------------------------------
// Phase run commands (#156)
// ---------------------------------------------------------------------------

export async function invokePhaseRunList(sessionId: SessionId): Promise<PhaseRun[]> {
  const rows = await invoke<RawPhaseRunRow[]>('phase_run_list_for_session', { sessionId });
  return rows.map(rowToPhaseRun);
}

export interface PhaseRunInsertArgs {
  readonly id?: PhaseRunId;
  readonly sessionId: SessionId;
  readonly phaseDefinitionId: PhaseDefinitionId;
  readonly ordinal: number;
  readonly name: string;
  readonly status: PhaseRunStatus;
  readonly providerRunId?: ProviderRunId;
  readonly outputSummary?: string;
  readonly startedAt?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
}

export async function invokePhaseRunInsert(run: PhaseRunInsertArgs): Promise<PhaseRun> {
  const row = await invoke<RawPhaseRunRow>('phase_run_insert', {
    input: {
      id: run.id ?? null,
      sessionId: run.sessionId,
      phaseDefinitionId: run.phaseDefinitionId,
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
  readonly status: PhaseRunStatus;
  readonly providerRunId?: ProviderRunId;
  readonly outputSummary?: string;
  readonly startedAt?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
}

export async function invokePhaseRunUpdateStatus(
  id: PhaseRunId,
  fields: PhaseRunUpdateFields,
): Promise<PhaseRun> {
  const row = await invoke<RawPhaseRunRow>('phase_run_update_status', {
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

// ---------------------------------------------------------------------------
// Parallel phase group commands (#207)
// ---------------------------------------------------------------------------

interface RawParallelPhaseGroupRow {
  readonly id: string;
  readonly sessionId: string;
  readonly ordinal: number;
  readonly mergeStrategy: string;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

function rowToParallelPhaseGroup(row: RawParallelPhaseGroupRow): ParallelPhaseGroup {
  return {
    id: row.id as ParallelPhaseGroupId,
    sessionId: row.sessionId as SessionId,
    ordinal: row.ordinal,
    mergeStrategy: row.mergeStrategy as ParallelMergeStrategy,
    createdAt: row.createdAt as IsoDateTime,
    completedAt: row.completedAt != null ? (row.completedAt as IsoDateTime) : null,
  };
}

export interface ParallelPhaseGroupCreateArgs {
  readonly id?: ParallelPhaseGroupId;
  readonly sessionId: SessionId;
  readonly ordinal: number;
  readonly mergeStrategy: ParallelMergeStrategy;
  readonly createdAt?: IsoDateTime;
}

export async function invokeParallelPhaseGroupCreate(
  args: ParallelPhaseGroupCreateArgs,
): Promise<ParallelPhaseGroup> {
  const row = await invoke<RawParallelPhaseGroupRow>('parallel_phase_group_create', {
    input: {
      id: args.id ?? null,
      sessionId: args.sessionId,
      ordinal: args.ordinal,
      mergeStrategy: args.mergeStrategy,
      createdAt: args.createdAt ?? null,
    },
  });
  return rowToParallelPhaseGroup(row);
}

export async function invokeParallelPhaseGroupList(
  sessionId: SessionId,
): Promise<ParallelPhaseGroup[]> {
  const rows = await invoke<RawParallelPhaseGroupRow[]>('parallel_phase_group_list', {
    sessionId,
  });
  return rows.map(rowToParallelPhaseGroup);
}

export async function invokeParallelPhaseGroupGet(
  id: ParallelPhaseGroupId,
): Promise<ParallelPhaseGroup | null> {
  const row = await invoke<RawParallelPhaseGroupRow | null>('parallel_phase_group_get', { id });
  return row != null ? rowToParallelPhaseGroup(row) : null;
}

export async function invokeParallelPhaseGroupDelete(id: ParallelPhaseGroupId): Promise<void> {
  return invoke<void>('parallel_phase_group_delete', { id });
}

export async function invokeParallelPhaseGroupUpdateCompletedAt(
  id: ParallelPhaseGroupId,
  completedAt: IsoDateTime,
): Promise<ParallelPhaseGroup> {
  const row = await invoke<RawParallelPhaseGroupRow>('parallel_phase_group_update_completed_at', {
    id,
    completedAt,
  });
  return rowToParallelPhaseGroup(row);
}
