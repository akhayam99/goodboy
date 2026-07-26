import { invoke } from '@tauri-apps/api/core';
import type {
  AgentEffort,
  AgentRole,
  AgentSourceKind,
  IsoDateTime,
  ParallelMergeStrategy,
  ParallelGroup,
  ParallelGroupId,
  Step,
  StepDef,
  StepDefId,
  StepId,
  Agent,
  AgentId,
  AgentStatus,
  VerbosityLevel,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  ProviderRunId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { ProviderId } from '@goodboy/types';

type RawWorkflowStepRow = {
  readonly id: string;
  readonly workflowId: string;
  readonly libraryStepId: string | null;
  readonly role: string | null;
  readonly ordinal: number;
  readonly name: string;
  readonly promptPrefix: string;
  readonly expectedOutput: string | null;
  readonly providerOverride: string | null;
  readonly modelOverride: string | null;
  readonly effort: string | null;
  readonly verbosity: string | null;
  readonly parallelGroup: number | null;
};

type RawStepDefRow = {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly baseStepId: string | null;
  readonly role: string;
  readonly name: string;
  readonly promptPrefix: string;
  readonly providerDefault: string | null;
  readonly modelDefault: string | null;
  readonly effortDefault: string | null;
  readonly verbosityDefault: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type RawWorkflowRow = {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly description: string;
  readonly goal: string | null;
  readonly processText: string | null;
  readonly steps: ReadonlyArray<RawWorkflowStepRow>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: number | null;
  readonly isPreset: boolean;
};

type RawAgentRow = {
  readonly id: string;
  readonly sessionId: string;
  readonly stepId: string | null;
  readonly workflowRunId: string | null;
  readonly parentAgentId: string | null;
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
  readonly doneAt: string | null;
  readonly kind: string | null;
  readonly verbosity: string | null;
  readonly sourceThreadId: string | null;
  readonly sourceThreadIds: string | null;
  readonly sourceCommentUrl: string | null;
  readonly sourceKind: string | null;
  readonly domainsJson: string | null;
};

type ParseStringArrayParams = {
  readonly value: string | null;
};

function rowToStep(row: RawWorkflowStepRow): Step {
  return {
    id: row.id as StepId,
    workflowId: row.workflowId as WorkflowId,
    ordinal: row.ordinal,
    name: row.name,
    promptPrefix: row.promptPrefix,
    ...(row.expectedOutput != null &&
      row.expectedOutput !== '' && { expectedOutput: row.expectedOutput }),
    ...(row.libraryStepId != null && { libraryStepId: row.libraryStepId as StepDefId }),
    ...(row.role != null && { role: row.role as AgentRole }),
    ...(row.providerOverride != null && { providerOverride: row.providerOverride as ProviderId }),
    ...(row.modelOverride != null && { modelOverride: row.modelOverride }),
    ...(row.effort != null && { effort: row.effort as AgentEffort }),
    ...(row.verbosity != null && { verbosity: row.verbosity as VerbosityLevel }),
    ...(row.parallelGroup != null && { parallelGroup: row.parallelGroup }),
  };
}

function rowToStepDef(row: RawStepDefRow): StepDef {
  return {
    id: row.id as StepDefId,
    workspaceId: row.workspaceId as WorkspaceId | null,
    role: row.role as AgentRole,
    name: row.name,
    promptPrefix: row.promptPrefix,
    createdAt: row.createdAt as IsoDateTime,
    updatedAt: row.updatedAt as IsoDateTime,
    ...(row.baseStepId != null && { baseStepId: row.baseStepId as StepDefId }),
    ...(row.providerDefault != null && { providerDefault: row.providerDefault as ProviderId }),
    ...(row.modelDefault != null && { modelDefault: row.modelDefault }),
    ...(row.effortDefault != null && { effortDefault: row.effortDefault as AgentEffort }),
    ...(row.verbosityDefault != null && {
      verbosityDefault: row.verbosityDefault as VerbosityLevel,
    }),
  };
}

function rowToWorkflow(row: RawWorkflowRow): Workflow {
  return {
    id: row.id as WorkflowId,
    workspaceId: row.workspaceId as WorkspaceId,
    name: row.name,
    description: row.description,
    ...(row.goal != null && { goal: row.goal }),
    ...(row.processText != null && row.processText !== '' && { processText: row.processText }),
    steps: row.steps.map(rowToStep),
    isPreset: row.isPreset,
    createdAt: row.createdAt as IsoDateTime,
    updatedAt: row.updatedAt as IsoDateTime,
    ...(row.deletedAt != null && {
      deletedAt: new Date(row.deletedAt * 1000).toISOString() as IsoDateTime,
    }),
  };
}

const parseStringArray = ({ value }: ParseStringArrayParams): ReadonlyArray<string> => {
  if (value === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((threadId): threadId is string => typeof threadId === 'string');
  } catch {
    return [];
  }
};

function rowToAgent(row: RawAgentRow): Agent {
  const sourceThreadIds = parseStringArray({ value: row.sourceThreadIds });
  const domains = parseStringArray({ value: row.domainsJson });
  return {
    id: row.id as AgentId,
    sessionId: row.sessionId as SessionId,
    ...(row.stepId != null && { stepId: row.stepId as StepId }),
    ...(row.workflowRunId != null && { workflowRunId: row.workflowRunId as WorkflowRunId }),
    ...(row.parentAgentId != null && { parentAgentId: row.parentAgentId as AgentId }),
    ordinal: row.ordinal,
    name: row.name,
    status: row.status as AgentStatus,
    ...(row.providerRunId != null && { runId: row.providerRunId as ProviderRunId }),
    ...(row.outputSummary != null && { outputSummary: row.outputSummary }),
    ...(row.startedAt != null && { startedAt: row.startedAt as IsoDateTime }),
    ...(row.completedAt != null && { completedAt: row.completedAt as IsoDateTime }),
    ...(row.providerSessionId != null && { providerSessionId: row.providerSessionId }),
    ...(row.lastFinishedAt != null && { lastFinishedAt: row.lastFinishedAt as IsoDateTime }),
    ...(row.lastViewedAt != null && { lastViewedAt: row.lastViewedAt as IsoDateTime }),
    ...(row.doneAt != null && { doneAt: row.doneAt as IsoDateTime }),
    ...(row.kind != null && { kind: row.kind }),
    ...(row.verbosity != null && { verbosity: row.verbosity as VerbosityLevel }),
    ...(row.sourceThreadId != null && { sourceThreadId: row.sourceThreadId }),
    ...(sourceThreadIds.length > 0 && { sourceThreadIds }),
    ...(row.sourceCommentUrl != null && { sourceCommentUrl: row.sourceCommentUrl }),
    ...(row.sourceKind != null && { sourceKind: row.sourceKind as AgentSourceKind }),
    ...(domains.length > 0 && { domains }),
  };
}

export const invokeWorkflowList = async (workspaceId: WorkspaceId): Promise<Workflow[]> => {
  const rows = await invoke<RawWorkflowRow[]>('workflow_list', { workspaceId });
  return rows.map(rowToWorkflow);
};

export const invokeWorkflowsForSession = async (sessionId: SessionId): Promise<Workflow[]> => {
  const rows = await invoke<RawWorkflowRow[]>('workflows_for_session', { sessionId });
  return rows.map(rowToWorkflow);
};

export type WorkflowStepUpsertArgs = {
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
  readonly parallelGroup?: number;
};

export type WorkflowUpsertArgs = {
  readonly id?: WorkflowId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly description: string;
  readonly goal?: string;
  readonly processText?: string;
  readonly steps: ReadonlyArray<WorkflowStepUpsertArgs>;
  readonly isPreset?: boolean;
};

export const invokeWorkflowUpsert = async (args: WorkflowUpsertArgs): Promise<Workflow> => {
  const row = await invoke<RawWorkflowRow>('workflow_upsert', {
    input: {
      id: args.id ?? null,
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      goal: args.goal ?? null,
      processText: args.processText ?? null,
      isPreset: args.isPreset ?? true,
      steps: args.steps.map((d) => ({
        id: d.id ?? null,
        libraryStepId: d.libraryStepId ?? null,
        role: d.role ?? null,
        ordinal: d.ordinal,
        name: d.name,
        promptPrefix: d.promptPrefix,
        expectedOutput: d.expectedOutput ?? null,
        providerOverride: d.providerOverride ?? null,
        modelOverride: d.modelOverride ?? null,
        effort: d.effort ?? null,
        verbosity: d.verbosity ?? null,
        parallelGroup: d.parallelGroup ?? null,
      })),
    },
  });
  return rowToWorkflow(row);
};

export const invokeWorkflowDelete = async (id: WorkflowId): Promise<void> => {
  return invoke<void>('workflow_delete', { id });
};

export const invokeStepDefList = async (workspaceId: WorkspaceId): Promise<StepDef[]> => {
  const rows = await invoke<RawStepDefRow[]>('step_def_list', { workspaceId });
  return rows.map(rowToStepDef);
};

export type StepDefUpsertArgs = {
  readonly id?: StepDefId;
  readonly workspaceId: WorkspaceId | null;
  readonly baseStepId?: StepDefId;
  readonly role: AgentRole;
  readonly name: string;
  readonly promptPrefix: string;
  readonly providerDefault?: ProviderId;
  readonly modelDefault?: string;
  readonly effortDefault?: AgentEffort;
  readonly verbosityDefault?: VerbosityLevel;
};

export const invokeStepDefUpsert = async (args: StepDefUpsertArgs): Promise<StepDef> => {
  const row = await invoke<RawStepDefRow>('step_def_upsert', {
    input: {
      id: args.id ?? null,
      workspaceId: args.workspaceId,
      baseStepId: args.baseStepId ?? null,
      role: args.role,
      name: args.name,
      promptPrefix: args.promptPrefix,
      providerDefault: args.providerDefault ?? null,
      modelDefault: args.modelDefault ?? null,
      effortDefault: args.effortDefault ?? null,
      verbosityDefault: args.verbosityDefault ?? null,
    },
  });
  return rowToStepDef(row);
};

export const invokeStepDefDelete = async (id: StepDefId): Promise<void> => {
  return invoke<void>('step_def_delete', { id });
};

export const invokeAgentList = async (sessionId: SessionId): Promise<Agent[]> => {
  const rows = await invoke<RawAgentRow[]>('agent_list_for_session', { sessionId });
  return rows.map(rowToAgent);
};

export type AgentInsertArgs = {
  readonly id?: AgentId;
  readonly sessionId: SessionId;
  readonly stepId?: StepId;
  readonly workflowRunId?: WorkflowRunId;
  readonly parentAgentId?: AgentId;
  readonly ordinal: number;
  readonly name: string;
  readonly status: AgentStatus;
  readonly providerRunId?: ProviderRunId;
  readonly outputSummary?: string;
  readonly startedAt?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly kind?: string;
  readonly verbosity?: VerbosityLevel;
  readonly sourceThreadId?: string;
  readonly sourceThreadIds?: ReadonlyArray<string>;
  readonly sourceCommentUrl?: string;
  readonly sourceKind?: AgentSourceKind;
  readonly domains?: ReadonlyArray<string>;
};

export const invokeAgentInsert = async (run: AgentInsertArgs): Promise<Agent> => {
  const row = await invoke<RawAgentRow>('agent_insert', {
    input: {
      id: run.id ?? null,
      sessionId: run.sessionId,
      stepId: run.stepId ?? null,
      workflowRunId: run.workflowRunId ?? null,
      parentAgentId: run.parentAgentId ?? null,
      ordinal: run.ordinal,
      name: run.name,
      status: run.status,
      providerRunId: run.providerRunId ?? null,
      outputSummary: run.outputSummary ?? null,
      startedAt: run.startedAt ?? null,
      completedAt: run.completedAt ?? null,
      kind: run.kind ?? null,
      verbosity: run.verbosity ?? null,
      sourceThreadId: run.sourceThreadId ?? null,
      sourceThreadIds:
        run.sourceThreadIds !== undefined ? JSON.stringify(run.sourceThreadIds) : null,
      sourceCommentUrl: run.sourceCommentUrl ?? null,
      sourceKind: run.sourceKind ?? null,
      domainsJson: run.domains !== undefined ? JSON.stringify(run.domains) : null,
    },
  });
  return rowToAgent(row);
};

export const invokeAgentSetKind = async (id: AgentId, kind: string | null): Promise<void> => {
  return invoke<void>('agent_set_kind', { id, kind });
};

export const invokeAgentSetVerbosity = async (
  id: AgentId,
  verbosity: VerbosityLevel | null,
): Promise<void> => {
  return invoke<void>('agent_set_verbosity', { id, verbosity });
};

export type AgentUpdateFields = {
  readonly status: AgentStatus;
  readonly providerRunId?: ProviderRunId;
  readonly outputSummary?: string;
  readonly startedAt?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
};

export const invokeAgentUpdateStatus = async (
  id: AgentId,
  fields: AgentUpdateFields,
): Promise<Agent> => {
  const row = await invoke<RawAgentRow>('agent_update_status', {
    input: {
      id,
      status: fields.status,
      providerRunId: fields.providerRunId ?? null,
      outputSummary: fields.outputSummary ?? null,
      startedAt: fields.startedAt ?? null,
      completedAt: fields.completedAt ?? null,
    },
  });
  return rowToAgent(row);
};

export const invokeAgentSetProviderSessionId = async (
  id: AgentId,
  providerSessionId: string,
): Promise<void> => {
  await invoke<void>('agent_set_provider_session_id', {
    id,
    providerSessionId,
  });
};

export const invokeAgentMarkViewed = async (id: AgentId, at: IsoDateTime): Promise<void> => {
  await invoke<void>('agent_mark_viewed', { id, at });
};

export const invokeAgentSetDone = async (
  id: AgentId,
  done: boolean,
  at: IsoDateTime | null,
): Promise<void> => {
  await invoke<void>('agent_set_done', { id, done, at });
};

export const invokeWorkspacesWithUnread = async (): Promise<ReadonlyArray<WorkspaceId>> => {
  const ids = await invoke<string[]>('workspaces_with_unread');
  return ids as ReadonlyArray<string> as ReadonlyArray<WorkspaceId>;
};

type RawParallelGroupRow = {
  readonly id: string;
  readonly sessionId: string;
  readonly ordinal: number;
  readonly mergeStrategy: string;
  readonly createdAt: string;
  readonly completedAt: string | null;
};

function rowToParallelGroup(row: RawParallelGroupRow): ParallelGroup {
  return {
    id: row.id as ParallelGroupId,
    sessionId: row.sessionId as SessionId,
    ordinal: row.ordinal,
    mergeStrategy: row.mergeStrategy as ParallelMergeStrategy,
    createdAt: row.createdAt as IsoDateTime,
    completedAt: row.completedAt != null ? (row.completedAt as IsoDateTime) : null,
  };
}

export type ParallelGroupCreateArgs = {
  readonly id?: ParallelGroupId;
  readonly sessionId: SessionId;
  readonly ordinal: number;
  readonly mergeStrategy: ParallelMergeStrategy;
  readonly createdAt?: IsoDateTime;
};

export const invokeParallelGroupCreate = async (
  args: ParallelGroupCreateArgs,
): Promise<ParallelGroup> => {
  const row = await invoke<RawParallelGroupRow>('parallel_group_create', {
    input: {
      id: args.id ?? null,
      sessionId: args.sessionId,
      ordinal: args.ordinal,
      mergeStrategy: args.mergeStrategy,
      createdAt: args.createdAt ?? null,
    },
  });
  return rowToParallelGroup(row);
};

export const invokeParallelGroupUpdateCompletedAt = async (
  id: ParallelGroupId,
  completedAt: IsoDateTime,
): Promise<ParallelGroup> => {
  const row = await invoke<RawParallelGroupRow>('parallel_group_update_completed_at', {
    id,
    completedAt,
  });
  return rowToParallelGroup(row);
};
