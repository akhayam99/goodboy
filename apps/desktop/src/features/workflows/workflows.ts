import { CommandError, invokeCommand, toCommandError } from '../../shared/lib/invokeCommand';
import { tauriDatabase } from '../../shared/lib/db';
import {
  normalizeWorkflowRole,
  PlannerClient,
  polishStepExpectedOutput,
  polishStepInstruction,
  polishWorkflowGoal,
  polishWorkflowGuidance,
  type ExpectedOutputPolishInput,
  type GoalPolishDeps,
  type PlannerClientDeps,
  type StepPolishDeps,
  type StepPolishInput,
} from '@goodboy/core';
import {
  InvalidWorkflowNodeError,
  NodeNotMutableError,
  NotFoundError,
  insertAgent,
  insertAgentBatch,
  isWorkflowRoutingDecision,
  isWorkflowRoutingLock,
  isWorkflowTaskProfile,
  legacyStepRoutingLock,
  listAgentsForSessions,
  markAgentViewed,
  parseRoutingJson,
  recordAgentStatus,
  removeWorkflow,
  saveWorkflow,
  setAgentDone,
  setAgentProviderSession,
  setAgentVerbosity,
  updateWorkflowNodeRouting,
  type AgentBatchOutcome,
  type AgentInsertInput,
  type AgentStatusFields,
  type SaveWorkflowInput,
  type WorkflowNodeRouting,
  type WorkflowStepInput,
} from '@goodboy/db';
import type {
  AgentEffort,
  AgentRole,
  IsoDateTime,
  Step,
  StepDef,
  StepDefId,
  StepId,
  Agent,
  AgentId,
  VerbosityLevel,
  Workflow,
  WorkflowId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { ProviderId } from '@goodboy/types';
import { isStepSize, isWorkflowOrigin } from '@goodboy/types';

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
  readonly orchestratorReason: string | null;
  readonly routingLock: string | null;
  readonly routingDecision: string | null;
  readonly taskProfile: string | null;
  readonly size: string | null;
};

type RawStepDefRow = {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly role: string;
  readonly name: string;
  readonly promptPrefix: string;
  readonly providerDefault: string | null;
  readonly modelDefault: string | null;
  readonly effortDefault: string | null;
  readonly verbosityDefault: string | null;
  readonly expectedOutput: string | null;
  readonly baseStepId: string | null;
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
  readonly origin: string | null;
};

function rowToStep(row: RawWorkflowStepRow): Step {
  const routingDecision = parseRoutingJson({
    value: row.routingDecision,
    isValid: isWorkflowRoutingDecision,
    field: 'routing decision',
  });
  const routingLock =
    parseRoutingJson({
      value: row.routingLock,
      isValid: isWorkflowRoutingLock,
      field: 'routing lock',
    }) ??
    (routingDecision === null
      ? legacyStepRoutingLock({
          provider: row.providerOverride,
          model: row.modelOverride,
          effort: row.effort,
        })
      : null);
  return {
    id: row.id as StepId,
    workflowId: row.workflowId as WorkflowId,
    ordinal: row.ordinal,
    name: row.name,
    promptPrefix: row.promptPrefix,
    ...(row.expectedOutput != null &&
      row.expectedOutput !== '' && { expectedOutput: row.expectedOutput }),
    ...(row.libraryStepId != null && { libraryStepId: row.libraryStepId as StepDefId }),
    ...(row.role != null && { role: normalizeWorkflowRole({ role: row.role }) }),
    ...(row.providerOverride != null && { providerOverride: row.providerOverride as ProviderId }),
    ...(row.modelOverride != null && { modelOverride: row.modelOverride }),
    ...(row.effort != null && { effort: row.effort as AgentEffort }),
    ...(row.verbosity != null && { verbosity: row.verbosity as VerbosityLevel }),
    ...(row.orchestratorReason != null &&
      row.orchestratorReason !== '' && { orchestratorReason: row.orchestratorReason }),
    routingLock,
    routingDecision,
    taskProfile: parseRoutingJson({
      value: row.taskProfile,
      isValid: isWorkflowTaskProfile,
      field: 'task profile',
    }),
    ...(isStepSize(row.size) && { size: row.size }),
  };
}

function rowToStepDef(row: RawStepDefRow): StepDef {
  return {
    id: row.id as StepDefId,
    workspaceId: row.workspaceId as WorkspaceId,
    role: normalizeWorkflowRole({ role: row.role }),
    name: row.name,
    promptPrefix: row.promptPrefix,
    createdAt: row.createdAt as IsoDateTime,
    updatedAt: row.updatedAt as IsoDateTime,
    ...(row.expectedOutput != null && { expectedOutput: row.expectedOutput }),
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
    ...(isWorkflowOrigin(row.origin) && { origin: row.origin }),
    createdAt: row.createdAt as IsoDateTime,
    updatedAt: row.updatedAt as IsoDateTime,
    ...(row.deletedAt != null && {
      deletedAt: new Date(row.deletedAt).toISOString() as IsoDateTime,
    }),
  };
}

const failureKind = (error: unknown): string | null => {
  if (error instanceof NodeNotMutableError) {
    return 'node_not_mutable';
  }
  if (error instanceof InvalidWorkflowNodeError) {
    return 'invalid_routing';
  }
  if (error instanceof NotFoundError) {
    return error.entity === 'agent' ? 'run_not_found' : 'template_not_found';
  }
  return null;
};

const toWriteError = (error: unknown): CommandError => {
  const kind = failureKind(error);
  if (kind === null || !(error instanceof Error)) {
    return toCommandError(error);
  }
  return new CommandError({ kind, message: error.message, cause: error });
};

const persist = async <T>(write: () => Promise<T>): Promise<T> => {
  try {
    return await write();
  } catch (error) {
    throw toWriteError(error);
  }
};

export const invokeWorkflowList = async (workspaceId: WorkspaceId): Promise<Workflow[]> => {
  const rows = await invokeCommand<RawWorkflowRow[]>('workflow_list', { workspaceId });
  return rows.map(rowToWorkflow);
};

export const invokeWorkflowsForSession = async (sessionId: SessionId): Promise<Workflow[]> => {
  const rows = await invokeCommand<RawWorkflowRow[]>('workflows_for_session', { sessionId });
  return rows.map(rowToWorkflow);
};

export type WorkflowStepUpsertArgs = WorkflowStepInput;

export type WorkflowUpsertArgs = SaveWorkflowInput;

export const invokeWorkflowUpsert = (args: WorkflowUpsertArgs): Promise<Workflow> =>
  persist(() => saveWorkflow(tauriDatabase, args));

export const invokeWorkflowDelete = (id: WorkflowId): Promise<void> =>
  persist(() => removeWorkflow(tauriDatabase, id));

export const invokeStepDefList = async (workspaceId: WorkspaceId): Promise<StepDef[]> => {
  const rows = await invokeCommand<RawStepDefRow[]>('step_def_list', { workspaceId });
  return rows.map(rowToStepDef);
};

export type StepDefUpsertArgs = {
  readonly id?: StepDefId;
  readonly workspaceId: WorkspaceId;
  readonly baseStepId?: StepDefId;
  readonly role: AgentRole;
  readonly name: string;
  readonly promptPrefix: string;
  readonly expectedOutput?: string;
  readonly providerDefault?: ProviderId;
  readonly modelDefault?: string;
  readonly effortDefault?: AgentEffort;
  readonly verbosityDefault?: VerbosityLevel;
};

export const invokeStepDefUpsert = async (args: StepDefUpsertArgs): Promise<StepDef> => {
  const row = await invokeCommand<RawStepDefRow>('step_def_upsert', {
    input: {
      id: args.id ?? null,
      workspaceId: args.workspaceId,
      role: args.role,
      name: args.name,
      promptPrefix: args.promptPrefix,
      providerDefault: args.providerDefault ?? null,
      modelDefault: args.modelDefault ?? null,
      effortDefault: args.effortDefault ?? null,
      verbosityDefault: args.verbosityDefault ?? null,
      expectedOutput: args.expectedOutput ?? null,
      baseStepId: args.baseStepId ?? null,
    },
  });
  return rowToStepDef(row);
};

export const invokeStepDefDelete = async (id: StepDefId): Promise<void> => {
  return invokeCommand<void>('step_def_delete', { id });
};

const agentListRequestTails = new Map<SessionId, Promise<void>>();

export const invokeAgentList = async (sessionId: SessionId): Promise<Agent[]> => {
  const previous = agentListRequestTails.get(sessionId) ?? Promise.resolve();
  const request = previous.then(async () => {
    const bySession = await listAgentsForSessions(tauriDatabase, [sessionId]);
    return [...(bySession.get(sessionId) ?? [])];
  });
  const tail = request.then(
    () => undefined,
    () => undefined,
  );
  agentListRequestTails.set(sessionId, tail);
  try {
    return await request;
  } finally {
    if (agentListRequestTails.get(sessionId) === tail) {
      agentListRequestTails.delete(sessionId);
    }
  }
};

export type AgentInsertArgs = AgentInsertInput;

export const invokeAgentInsert = (run: AgentInsertArgs): Promise<Agent> =>
  persist(() => insertAgent(tauriDatabase, run));

export type AgentInsertBatchArgs = {
  readonly parentAgentId: AgentId;
  readonly children: ReadonlyArray<AgentInsertArgs>;
};

export type AgentInsertBatchResult = AgentBatchOutcome;

export const invokeAgentInsertBatch = (
  args: AgentInsertBatchArgs,
): Promise<AgentInsertBatchResult> => persist(() => insertAgentBatch(tauriDatabase, args));

export type WorkflowNodeRoutingUpdateArgs = WorkflowNodeRouting;

export const invokeWorkflowNodeRoutingUpdate = (
  args: WorkflowNodeRoutingUpdateArgs,
): Promise<void> => persist(() => updateWorkflowNodeRouting(tauriDatabase, args));

export const invokeAgentSetVerbosity = (
  id: AgentId,
  verbosity: VerbosityLevel | null,
): Promise<void> => persist(() => setAgentVerbosity(tauriDatabase, id, verbosity));

export type AgentUpdateFields = AgentStatusFields;

export const invokeAgentUpdateStatus = (id: AgentId, fields: AgentUpdateFields): Promise<Agent> =>
  persist(() => recordAgentStatus(tauriDatabase, id, fields));

type Params = {
  readonly id: AgentId;
  readonly providerSessionId: string;
  readonly providerSessionProviderId: ProviderId;
};

export const invokeAgentSetProviderSessionId = (params: Params): Promise<void> =>
  persist(() => setAgentProviderSession(tauriDatabase, params));

export const invokeAgentMarkViewed = (id: AgentId, at: IsoDateTime): Promise<void> =>
  persist(() => markAgentViewed(tauriDatabase, id, at));

export const invokeAgentSetDone = (
  id: AgentId,
  done: boolean,
  at: IsoDateTime | null,
): Promise<void> => persist(() => setAgentDone(tauriDatabase, id, done, at));

export const invokeWorkspacesWithUnread = async (): Promise<ReadonlyArray<WorkspaceId>> => {
  const ids = await invokeCommand<string[]>('workspaces_with_unread');
  return ids as ReadonlyArray<string> as ReadonlyArray<WorkspaceId>;
};

type PolishStepParams = {
  readonly deps: Omit<StepPolishDeps, 'invokeFn'>;
  readonly input: StepPolishInput;
};

export const polishWorkflowStep = ({ deps, input }: PolishStepParams): Promise<string | null> =>
  polishStepInstruction({ ...deps, invokeFn: invokeCommand }, input);

type PolishExpectedOutputParams = {
  readonly deps: Omit<StepPolishDeps, 'invokeFn'>;
  readonly input: ExpectedOutputPolishInput;
};

export const polishWorkflowExpectedOutput = ({
  deps,
  input,
}: PolishExpectedOutputParams): Promise<string | null> =>
  polishStepExpectedOutput({ ...deps, invokeFn: invokeCommand }, input);

type PolishGoalParams = {
  readonly deps: Omit<GoalPolishDeps, 'invokeFn'>;
  readonly goal: string;
};

export const polishWorkflowGoalText = ({ deps, goal }: PolishGoalParams): Promise<string | null> =>
  polishWorkflowGoal({ ...deps, invokeFn: invokeCommand }, goal);

type PolishGuidanceParams = {
  readonly deps: PolishGoalParams['deps'];
  readonly guidance: string;
};

export const polishWorkflowGuidanceText = ({
  deps,
  guidance,
}: PolishGuidanceParams): Promise<string | null> =>
  polishWorkflowGuidance({ ...deps, invokeFn: invokeCommand }, guidance);

type PlannerParams = {
  readonly deps: Omit<PlannerClientDeps, 'invokeFn'>;
};

export const createWorkflowPlanner = ({ deps }: PlannerParams): PlannerClient =>
  new PlannerClient({ ...deps, invokeFn: invokeCommand });
