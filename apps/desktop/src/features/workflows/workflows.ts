import { invoke } from '@tauri-apps/api/core';
import {
  normalizeAgentRole,
  parseClusterWriteScope,
  PlannerClient,
  polishStepInstruction,
  polishWorkflowGoal,
  type GoalPolishDeps,
  type PlannerClientDeps,
  type StepPolishDeps,
  type StepPolishInput,
} from '@goodboy/core';
import {
  isWorkflowRoutingDecision,
  isWorkflowRoutingLock,
  isWorkflowRoutingProposal,
  isWorkflowTaskProfile,
  legacyAgentRoutingDecision,
  legacyStepRoutingLock,
  parseRoutingJson,
  stringifyRoutingJson,
} from '@goodboy/db';
import type {
  AgentEffort,
  AgentRole,
  AgentSourceKind,
  IsoDateTime,
  Step,
  StepDef,
  StepDefId,
  StepId,
  Agent,
  AgentExecutionPurpose,
  AgentId,
  AgentStatus,
  CapabilityContinuation,
  CapabilityGrant,
  CapabilityGrantState,
  CapabilityObligation,
  CapabilityObligationDecision,
  CapabilityObligationState,
  CapabilityParentOutcome,
  CapabilityPurpose,
  CapabilityRequest,
  ClusterCompletionFinding,
  ClusterCompletionFindingTarget,
  ClusterCompletionHold,
  ClusterCompletionHoldReason,
  ClusterCompletionHoldState,
  ClusterExecutionGraph,
  ClusterExecutionNode,
  ClusterGraphNode,
  ClusterNodeResultState,
  ClusterNodeState,
  ContextReadOutcome,
  EvidenceInventory,
  GenerationCreationPath,
  GenerationLimitName,
  PlanClusterRole,
  VerbosityLevel,
  Workflow,
  WorkflowId,
  WorkflowOrigin,
  WorkflowRunId,
  ProviderRunId,
  SessionId,
  WorkspaceId,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowRoutingProposal,
  WorkflowTaskProfile,
} from '@goodboy/types';
import type { ProviderId } from '@goodboy/types';
import {
  AGENT_EXECUTION_PURPOSES,
  CLUSTER_NODE_RESULT_STATES,
  CLUSTER_NODE_STATES,
  PLAN_CLUSTER_ROLES,
  isWorkflowOrigin,
} from '@goodboy/types';

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
};

type RawClusterCompletionHoldRow = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly containerAgentId: AgentId;
  readonly sourceAgentId: AgentId;
  readonly sourceTurnId: string;
  readonly reason: ClusterCompletionHoldReason;
  readonly findingsJson: string;
  readonly state: ClusterCompletionHoldState;
  readonly resolutionEvidence: string | null;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFindingTarget = (value: unknown): value is ClusterCompletionFindingTarget =>
  value === 'implementer' || value === 'planner' || value === 'investigator' || value === 'tester';

const parseCompletionFindings = ({
  value,
}: {
  readonly value: string;
}): ReadonlyArray<ClusterCompletionFinding> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const findings: ClusterCompletionFinding[] = [];
  for (const entry of parsed) {
    if (!isRecord(entry) || typeof entry.reason !== 'string' || !isFindingTarget(entry.target)) {
      continue;
    }
    findings.push({ reason: entry.reason, target: entry.target });
  }
  return findings;
};

const completionHoldFromRow = ({
  row,
}: {
  readonly row: RawClusterCompletionHoldRow;
}): ClusterCompletionHold => ({
  id: row.id,
  sessionId: row.sessionId,
  workflowRunId: row.workflowRunId,
  containerAgentId: row.containerAgentId,
  sourceAgentId: row.sourceAgentId,
  sourceTurnId: row.sourceTurnId,
  reason: row.reason,
  findings: parseCompletionFindings({ value: row.findingsJson }),
  state: row.state,
  resolutionEvidence: row.resolutionEvidence,
  resolvedAt: row.resolvedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

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
  readonly providerSessionProviderId: string | null;
  readonly lastFinishedAt: string | null;
  readonly lastViewedAt: string | null;
  readonly doneAt: string | null;
  readonly kind: string | null;
  readonly executionPurpose: string | null;
  readonly verbosity: string | null;
  readonly effort: string | null;
  readonly modelOverride: string | null;
  readonly providerOverride: string | null;
  readonly sourceThreadId: string | null;
  readonly sourceThreadIds: string | null;
  readonly sourceCommentUrl: string | null;
  readonly sourceKind: string | null;
  readonly domainsJson: string | null;
  readonly routingLock: string | null;
  readonly routingDecision: string | null;
  readonly taskProfile: string | null;
};

type ParseStringArrayParams = {
  readonly value: string | null;
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
    ...(row.role != null && { role: normalizeAgentRole({ role: row.role }) }),
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
  };
}

function rowToStepDef(row: RawStepDefRow): StepDef {
  return {
    id: row.id as StepDefId,
    workspaceId: row.workspaceId as WorkspaceId | null,
    role: normalizeAgentRole({ role: row.role }),
    name: row.name,
    promptPrefix: row.promptPrefix,
    createdAt: row.createdAt as IsoDateTime,
    updatedAt: row.updatedAt as IsoDateTime,
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
  const routingLock = parseRoutingJson({
    value: row.routingLock,
    isValid: isWorkflowRoutingLock,
    field: 'routing lock',
  });
  const storedRoutingDecision = parseRoutingJson({
    value: row.routingDecision,
    isValid: isWorkflowRoutingDecision,
    field: 'routing decision',
  });
  const routingDecision =
    storedRoutingDecision ??
    (row.stepId === null && routingLock === null
      ? legacyAgentRoutingDecision({
          provider: row.providerOverride,
          model: row.modelOverride,
          effort: row.effort,
        })
      : null);
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
    ...(row.providerSessionProviderId != null && {
      providerSessionProviderId: row.providerSessionProviderId as ProviderId,
    }),
    ...(row.lastFinishedAt != null && { lastFinishedAt: row.lastFinishedAt as IsoDateTime }),
    ...(row.lastViewedAt != null && { lastViewedAt: row.lastViewedAt as IsoDateTime }),
    ...(row.doneAt != null && { doneAt: row.doneAt as IsoDateTime }),
    ...(row.kind != null && { kind: row.kind }),
    executionPurpose:
      AGENT_EXECUTION_PURPOSES.find((purpose) => purpose === row.executionPurpose) ?? null,
    ...(row.verbosity != null && { verbosity: row.verbosity as VerbosityLevel }),
    ...(row.effort != null && { effort: row.effort as AgentEffort }),
    ...(row.modelOverride != null && { modelOverride: row.modelOverride }),
    ...(row.providerOverride != null && { providerOverride: row.providerOverride as ProviderId }),
    ...(row.sourceThreadId != null && { sourceThreadId: row.sourceThreadId }),
    ...(sourceThreadIds.length > 0 && { sourceThreadIds }),
    ...(row.sourceCommentUrl != null && { sourceCommentUrl: row.sourceCommentUrl }),
    ...(row.sourceKind != null && { sourceKind: row.sourceKind as AgentSourceKind }),
    ...(domains.length > 0 && { domains }),
    routingLock,
    routingDecision,
    taskProfile: parseRoutingJson({
      value: row.taskProfile,
      isValid: isWorkflowTaskProfile,
      field: 'task profile',
    }),
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
  readonly orchestratorReason?: string;
  readonly routingLock?: WorkflowRoutingLock | null;
  readonly routingDecision?: WorkflowRoutingDecision | null;
  readonly taskProfile?: WorkflowTaskProfile | null;
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
  readonly origin?: WorkflowOrigin;
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
      origin: args.origin ?? null,
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
        orchestratorReason: d.orchestratorReason ?? null,
        routingLock: stringifyRoutingJson({
          value: d.routingLock ?? null,
          isValid: isWorkflowRoutingLock,
          field: 'routing lock',
        }),
        routingDecision: stringifyRoutingJson({
          value: d.routingDecision ?? null,
          isValid: isWorkflowRoutingDecision,
          field: 'routing decision',
        }),
        taskProfile: stringifyRoutingJson({
          value: d.taskProfile ?? null,
          isValid: isWorkflowTaskProfile,
          field: 'task profile',
        }),
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

const agentListRequestTails = new Map<SessionId, Promise<void>>();

export const invokeAgentList = async (sessionId: SessionId): Promise<Agent[]> => {
  const previous = agentListRequestTails.get(sessionId) ?? Promise.resolve();
  const request = previous.then(async () => {
    const rows = await invoke<RawAgentRow[]>('agent_list_for_session', { sessionId });
    return rows.map(rowToAgent);
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

export const invokeClusterCompletionHolds = async ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): Promise<ReadonlyArray<ClusterCompletionHold>> => {
  const rows = await invoke<RawClusterCompletionHoldRow[]>('cluster_completion_holds_for_session', {
    sessionId,
  });
  return rows.map((row) => completionHoldFromRow({ row }));
};

type RecordClusterCompletionHoldParams = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly containerAgentId: AgentId;
  readonly sourceAgentId: AgentId;
  readonly sourceTurnId: string;
  readonly reason: ClusterCompletionHoldReason;
  readonly findings: ReadonlyArray<ClusterCompletionFinding>;
};

export const invokeClusterCompletionHoldRecord = async ({
  id,
  sessionId,
  workflowRunId,
  containerAgentId,
  sourceAgentId,
  sourceTurnId,
  reason,
  findings,
}: RecordClusterCompletionHoldParams): Promise<ClusterCompletionHold> => {
  const row = await invoke<RawClusterCompletionHoldRow>('cluster_completion_hold_record', {
    input: {
      id,
      sessionId,
      workflowRunId,
      containerAgentId,
      sourceAgentId,
      sourceTurnId,
      reason,
      findingsJson: JSON.stringify(findings),
    },
  });
  return completionHoldFromRow({ row });
};

type RawCapabilityRequestRow = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly obligationId: string;
  readonly requesterAgentId: AgentId;
  readonly sourceTurnId: string;
  readonly targetRole: string;
  readonly purpose: CapabilityPurpose;
  readonly question: string;
  readonly scopeJson: string;
  readonly evidenceJson: string;
  readonly gap: string;
  readonly expectedOutput: string;
  readonly continuation: CapabilityContinuation;
  readonly routingProposal: string | null;
  readonly inventoryRevision: string;
  readonly createdAt: string;
};

type RawCapabilityObligationRow = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly identity: string;
  readonly requesterAgentId: AgentId;
  readonly targetRole: string;
  readonly purpose: CapabilityPurpose;
  readonly state: CapabilityObligationState;
  readonly requesterParentAgentId?: AgentId | null;
  readonly ownerAgentId: AgentId | null;
  readonly decision: CapabilityObligationDecision | null;
  readonly decisionReason: string | null;
  readonly satisfiedRevision: string | null;
  readonly childAgentId: AgentId | null;
  readonly deliveredAt: string | null;
  readonly deliveryReceipt: string | null;
  readonly requests: ReadonlyArray<RawCapabilityRequestRow>;
  readonly holdIds: ReadonlyArray<string>;
  readonly createdAt: string;
  readonly updatedAt: string;
};

const capabilityRequestFromRow = ({
  row,
}: {
  readonly row: RawCapabilityRequestRow;
}): CapabilityRequest => ({
  id: row.id,
  sessionId: row.sessionId,
  workflowRunId: row.workflowRunId,
  obligationId: row.obligationId,
  requesterAgentId: row.requesterAgentId,
  sourceTurnId: row.sourceTurnId,
  targetRole: normalizeAgentRole({ role: row.targetRole }),
  purpose: row.purpose,
  question: row.question,
  scope: parseStringArray({ value: row.scopeJson }),
  evidenceRefs: parseStringArray({ value: row.evidenceJson }),
  gap: row.gap,
  expectedOutput: row.expectedOutput,
  continuation: row.continuation,
  routingProposal: parseRoutingJson({
    value: row.routingProposal,
    isValid: isWorkflowRoutingProposal,
    field: 'routing proposal',
  }),
  inventoryRevision: row.inventoryRevision,
  createdAt: row.createdAt,
});

const capabilityObligationFromRow = ({
  row,
}: {
  readonly row: RawCapabilityObligationRow;
}): CapabilityObligation => ({
  id: row.id,
  sessionId: row.sessionId,
  workflowRunId: row.workflowRunId,
  identity: row.identity,
  requesterAgentId: row.requesterAgentId,
  requesterParentAgentId: row.requesterParentAgentId ?? null,
  targetRole: normalizeAgentRole({ role: row.targetRole }),
  purpose: row.purpose,
  state: row.state,
  ownerAgentId: row.ownerAgentId,
  decision: row.decision,
  decisionReason: row.decisionReason,
  satisfiedRevision: row.satisfiedRevision,
  childAgentId: row.childAgentId,
  deliveredAt: row.deliveredAt,
  deliveryReceipt: row.deliveryReceipt,
  requests: row.requests.map((request) => capabilityRequestFromRow({ row: request })),
  holdIds: row.holdIds,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const invokeCapabilityObligations = async ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): Promise<ReadonlyArray<CapabilityObligation>> => {
  const rows = await invoke<RawCapabilityObligationRow[]>('capability_obligations_for_session', {
    sessionId,
  });
  return rows.map((row) => capabilityObligationFromRow({ row }));
};

export type RecordCapabilityNeedParams = {
  readonly requestId: string;
  readonly obligationId: string;
  readonly identity: string;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly requesterAgentId: AgentId;
  readonly sourceTurnId: string;
  readonly targetRole: AgentRole;
  readonly purpose: CapabilityPurpose;
  readonly question: string;
  readonly scope: ReadonlyArray<string>;
  readonly evidenceRefs: ReadonlyArray<string>;
  readonly gap: string;
  readonly expectedOutput: string;
  readonly continuation: CapabilityContinuation;
  readonly routingProposal: WorkflowRoutingProposal | null;
  readonly inventoryRevision: string;
  readonly holdContainerAgentId: AgentId | null;
};

export const invokeCapabilityNeedRecord = async (
  need: RecordCapabilityNeedParams,
): Promise<CapabilityObligation> => {
  const row = await invoke<RawCapabilityObligationRow>('capability_need_record', {
    input: {
      requestId: need.requestId,
      obligationId: need.obligationId,
      identity: need.identity,
      sessionId: need.sessionId,
      workflowRunId: need.workflowRunId,
      requesterAgentId: need.requesterAgentId,
      sourceTurnId: need.sourceTurnId,
      targetRole: need.targetRole,
      purpose: need.purpose,
      question: need.question,
      scopeJson: JSON.stringify(need.scope),
      evidenceJson: JSON.stringify(need.evidenceRefs),
      gap: need.gap,
      expectedOutput: need.expectedOutput,
      continuation: need.continuation,
      routingProposal: stringifyRoutingJson({
        value: need.routingProposal,
        isValid: isWorkflowRoutingProposal,
        field: 'routing proposal',
      }),
      inventoryRevision: need.inventoryRevision,
      holdContainerAgentId: need.holdContainerAgentId,
    },
  });
  return capabilityObligationFromRow({ row });
};

type RawCapabilityGrantRow = {
  readonly id: string;
  readonly obligationId: string;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly grantedRole: string;
  readonly purpose: CapabilityPurpose;
  readonly continuation: CapabilityContinuation;
  readonly parentOutcome: CapabilityParentOutcome;
  readonly childAgentId: AgentId | null;
  readonly replacementAgentId: AgentId | null;
  readonly verificationAgentId: AgentId | null;
  readonly transferredWork: string | null;
  readonly state: CapabilityGrantState;
  readonly createdAt: string;
  readonly updatedAt: string;
};

const capabilityGrantFromRow = ({
  row,
}: {
  readonly row: RawCapabilityGrantRow;
}): CapabilityGrant => ({
  id: row.id,
  obligationId: row.obligationId,
  sessionId: row.sessionId,
  workflowRunId: row.workflowRunId,
  grantedRole: normalizeAgentRole({ role: row.grantedRole }),
  purpose: row.purpose,
  continuation: row.continuation,
  parentOutcome: row.parentOutcome,
  childAgentId: row.childAgentId,
  replacementAgentId: row.replacementAgentId,
  verificationAgentId: row.verificationAgentId,
  transferredWork: row.transferredWork,
  state: row.state,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const invokeCapabilityGrants = async ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): Promise<ReadonlyArray<CapabilityGrant>> => {
  const rows = await invoke<RawCapabilityGrantRow[]>('capability_grants_for_session', {
    sessionId,
  });
  return rows.map((row) => capabilityGrantFromRow({ row }));
};

export type ClaimCapabilityGrantParams = {
  readonly id: string;
  readonly obligationId: string;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly grantedRole: AgentRole;
  readonly purpose: CapabilityPurpose;
  readonly continuation: CapabilityContinuation;
  readonly parentOutcome: CapabilityParentOutcome;
  readonly transferredWork: string | null;
};

export type CapabilityGrantClaim = Readonly<{
  grant: CapabilityGrant;
  isFirstDelivery: boolean;
}>;

export const invokeCapabilityGrantClaim = async (
  input: ClaimCapabilityGrantParams,
): Promise<CapabilityGrantClaim> => {
  const claim = await invoke<{
    readonly grant: RawCapabilityGrantRow;
    readonly isFirstDelivery: boolean;
  }>('capability_grant_claim', { input });
  return {
    grant: capabilityGrantFromRow({ row: claim.grant }),
    isFirstDelivery: claim.isFirstDelivery,
  };
};

export type UpdateCapabilityGrantParams = {
  readonly obligationId: string;
  readonly state: CapabilityGrantState;
  readonly childAgentId: AgentId | null;
  readonly replacementAgentId: AgentId | null;
  readonly verificationAgentId: AgentId | null;
};

export const invokeCapabilityGrantUpdate = async (
  input: UpdateCapabilityGrantParams,
): Promise<CapabilityGrant> => {
  const row = await invoke<RawCapabilityGrantRow>('capability_grant_update', { input });
  return capabilityGrantFromRow({ row });
};

export type DecideCapabilityObligationParams = {
  readonly obligationId: string;
  readonly decision: CapabilityObligationDecision;
  readonly reason: string;
};

export const invokeCapabilityObligationDecide = async (
  input: DecideCapabilityObligationParams,
): Promise<CapabilityObligation> => {
  const row = await invoke<RawCapabilityObligationRow>('capability_obligation_decide', { input });
  return capabilityObligationFromRow({ row });
};

export type ReopenCapabilityObligationParams = {
  readonly obligationId: string;
  readonly reason: string;
};

export const invokeCapabilityObligationReopen = async (
  input: ReopenCapabilityObligationParams,
): Promise<CapabilityObligation> => {
  const row = await invoke<RawCapabilityObligationRow>('capability_obligation_reopen', { input });
  return capabilityObligationFromRow({ row });
};

export type SettleCapabilityObligationParams = {
  readonly obligationId: string;
  readonly verifiedRevision: string;
  readonly deliveryReceipt: string;
};

export const invokeCapabilityObligationSettle = async (
  input: SettleCapabilityObligationParams,
): Promise<CapabilityObligation> => {
  const row = await invoke<RawCapabilityObligationRow>('capability_obligation_settle', { input });
  return capabilityObligationFromRow({ row });
};

export type RecordEvidenceInventoryParams = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly agentId: AgentId;
  readonly inventory: EvidenceInventory;
};

export const invokeEvidenceInventoryRecord = async ({
  sessionId,
  workflowRunId,
  agentId,
  inventory,
}: RecordEvidenceInventoryParams): Promise<void> => {
  await invoke('evidence_inventory_record', {
    input: {
      sessionId,
      workflowRunId,
      agentId,
      revision: inventory.revision,
      entriesJson: JSON.stringify(inventory.entries),
      omittedCount: inventory.omittedCount,
    },
  });
};

export type EvidenceDeliveryEntry = Readonly<{
  sourceId: string;
  requestedRange: string | null;
  outcome: ContextReadOutcome;
  deliveredChars: number;
  reason: string;
}>;

export type RecordEvidenceDeliveryParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly sourceTurnId: string;
  readonly inventoryRevision: string;
  readonly receipts: ReadonlyArray<EvidenceDeliveryEntry>;
};

export const invokeEvidenceDeliveryRecord = async ({
  sessionId,
  agentId,
  sourceTurnId,
  inventoryRevision,
  receipts,
}: RecordEvidenceDeliveryParams): Promise<void> => {
  await invoke('evidence_delivery_record', {
    input: { sessionId, agentId, sourceTurnId, inventoryRevision, receipts },
  });
};

export type GenerationReservation = Readonly<{
  reservationId: string;
  depth: number;
  causalRootAgentId: AgentId | null;
}>;

type RawGenerationReservationOutcome = {
  readonly kind: string;
  readonly reservations: ReadonlyArray<GenerationReservation>;
  readonly limit: GenerationLimitName | null;
  readonly reason: string | null;
  readonly isFirstRefusal: boolean;
};

export type GenerationReservationOutcome =
  | Readonly<{ kind: 'granted'; reservations: ReadonlyArray<GenerationReservation> }>
  | Readonly<{
      kind: 'refused';
      limit: GenerationLimitName;
      reason: string;
      isFirstRefusal: boolean;
    }>;

export type ReserveAgentGenerationParams = {
  readonly reservationId: string;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly parentAgentId: AgentId | null;
  readonly creationPath: GenerationCreationPath;
  readonly count: number;
  readonly obligationId?: string | null;
  readonly purpose?: string | null;
};

export const invokeAgentGenerationReserve = async ({
  reservationId,
  sessionId,
  workflowRunId,
  parentAgentId,
  creationPath,
  count,
  obligationId = null,
  purpose = null,
}: ReserveAgentGenerationParams): Promise<GenerationReservationOutcome> => {
  const outcome = await invoke<RawGenerationReservationOutcome>('agent_generation_reserve', {
    input: {
      reservationId,
      sessionId,
      workflowRunId,
      parentAgentId,
      creationPath,
      count,
      obligationId,
      purpose,
    },
  });
  if (outcome.kind === 'granted') {
    return { kind: 'granted', reservations: outcome.reservations };
  }
  return {
    kind: 'refused',
    limit: outcome.limit ?? 'lineage',
    reason: outcome.reason ?? 'the generation ledger refused this creation',
    isFirstRefusal: outcome.isFirstRefusal,
  };
};

type RawClusterExecutionNodeRow = {
  readonly nodeId: string;
  readonly agentId: AgentId | null;
  readonly ordinal: number;
  readonly role: string;
  readonly state: string;
  readonly supersededBy: string | null;
  readonly revision: number;
  readonly resultState: string;
};

type RawClusterExecutionGraphRow = {
  readonly containerAgentId: AgentId;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly planId: string | null;
  readonly goalTitle: string;
  readonly executionVersion: number;
  readonly graphJson: string;
  readonly revision: number;
  readonly frozenReason: string | null;
  readonly frozenObligationId: string | null;
  readonly createdAt: string;
  readonly nodes: ReadonlyArray<RawClusterExecutionNodeRow>;
};

const toPlanClusterRole = ({ value }: { readonly value: string }): PlanClusterRole =>
  PLAN_CLUSTER_ROLES.find((role) => role === value) ?? 'implementer';

const toClusterNodeState = ({ value }: { readonly value: string }): ClusterNodeState =>
  CLUSTER_NODE_STATES.find((state) => state === value) ?? 'active';

const toClusterNodeResultState = ({ value }: { readonly value: string }): ClusterNodeResultState =>
  CLUSTER_NODE_RESULT_STATES.find((state) => state === value) ?? 'pending';

const parseGraphNodes = ({
  value,
}: {
  readonly value: string;
}): ReadonlyArray<ClusterGraphNode> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const nodes: ClusterGraphNode[] = [];
  for (const entry of parsed) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || entry.id.length === 0) {
      continue;
    }
    const writeScope = parseClusterWriteScope({ value: entry.writeScope, label: `"${entry.id}"` });
    nodes.push({
      id: entry.id,
      ordinal: typeof entry.ordinal === 'number' ? entry.ordinal : nodes.length,
      title: typeof entry.title === 'string' ? entry.title : '',
      instructions: typeof entry.instructions === 'string' ? entry.instructions : '',
      role: toPlanClusterRole({ value: typeof entry.role === 'string' ? entry.role : '' }),
      dependsOn: Array.isArray(entry.dependsOn)
        ? entry.dependsOn.filter((dep): dep is string => typeof dep === 'string')
        : [],
      expectedOutput: typeof entry.expectedOutput === 'string' ? entry.expectedOutput : null,
      ...(writeScope.kind === 'valid' && { writeScope: writeScope.scope }),
    });
  }
  return nodes;
};

const executionGraphFromRow = ({
  row,
}: {
  readonly row: RawClusterExecutionGraphRow;
}): ClusterExecutionGraph => ({
  containerAgentId: row.containerAgentId,
  sessionId: row.sessionId,
  workflowRunId: row.workflowRunId,
  planId: row.planId,
  goalTitle: row.goalTitle,
  graph: {
    executionVersion: row.executionVersion,
    nodes: parseGraphNodes({ value: row.graphJson }),
  },
  nodes: row.nodes.map((node) => ({
    nodeId: node.nodeId,
    agentId: node.agentId,
    ordinal: node.ordinal,
    role: toPlanClusterRole({ value: node.role }),
    state: toClusterNodeState({ value: node.state }),
    supersededBy: node.supersededBy,
    revision: node.revision,
    resultState: toClusterNodeResultState({ value: node.resultState }),
  })),
  revision: row.revision,
  frozenReason: row.frozenReason,
  frozenObligationId: row.frozenObligationId,
  createdAt: row.createdAt as IsoDateTime,
});

export const invokeClusterExecutionGraphs = async ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): Promise<ReadonlyArray<ClusterExecutionGraph>> => {
  const rows = await invoke<RawClusterExecutionGraphRow[]>('cluster_execution_graphs_for_session', {
    sessionId,
  });
  return rows.map((row) => executionGraphFromRow({ row }));
};

export type ClusterExecutionNodeSeed = Readonly<{
  nodeId: string;
  agentId: AgentId | null;
  ordinal: number;
  role: PlanClusterRole;
}>;

type RecordClusterExecutionGraphParams = {
  readonly containerAgentId: AgentId;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly planId: string | null;
  readonly goalTitle: string;
  readonly executionVersion: number;
  readonly graphNodes: ReadonlyArray<ClusterGraphNode>;
  readonly nodes: ReadonlyArray<ClusterExecutionNodeSeed>;
};

export const invokeClusterExecutionGraphRecord = async ({
  containerAgentId,
  sessionId,
  workflowRunId,
  planId,
  goalTitle,
  executionVersion,
  graphNodes,
  nodes,
}: RecordClusterExecutionGraphParams): Promise<ClusterExecutionGraph> => {
  const row = await invoke<RawClusterExecutionGraphRow>('cluster_execution_graph_record', {
    input: {
      containerAgentId,
      sessionId,
      workflowRunId,
      planId,
      goalTitle,
      executionVersion,
      graphJson: JSON.stringify(graphNodes),
      nodes,
    },
  });
  return executionGraphFromRow({ row });
};

export const invokeClusterCompletionHoldResolve = async ({
  id,
  resolutionEvidence,
}: {
  readonly id: string;
  readonly resolutionEvidence: string;
}): Promise<void> => {
  await invoke<void>('cluster_completion_hold_resolve', {
    input: { id, resolutionEvidence },
  });
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
  readonly executionPurpose?: AgentExecutionPurpose;
  readonly verbosity?: VerbosityLevel;
  readonly effort?: AgentEffort;
  readonly modelOverride?: string;
  readonly providerOverride?: ProviderId;
  readonly sourceThreadId?: string;
  readonly sourceThreadIds?: ReadonlyArray<string>;
  readonly sourceCommentUrl?: string;
  readonly sourceKind?: AgentSourceKind;
  readonly domains?: ReadonlyArray<string>;
  readonly routingLock?: WorkflowRoutingLock | null;
  readonly routingDecision?: WorkflowRoutingDecision | null;
  readonly taskProfile?: WorkflowTaskProfile | null;
  readonly generationReservationId?: string;
};

const toAgentInsertPayload = ({ run }: { readonly run: AgentInsertArgs }) => ({
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
  executionPurpose: run.executionPurpose ?? null,
  verbosity: run.verbosity ?? null,
  effort: run.effort ?? null,
  modelOverride: run.modelOverride ?? null,
  providerOverride: run.providerOverride ?? null,
  sourceThreadId: run.sourceThreadId ?? null,
  sourceThreadIds: run.sourceThreadIds !== undefined ? JSON.stringify(run.sourceThreadIds) : null,
  sourceCommentUrl: run.sourceCommentUrl ?? null,
  sourceKind: run.sourceKind ?? null,
  domainsJson: run.domains !== undefined ? JSON.stringify(run.domains) : null,
  routingLock: stringifyRoutingJson({
    value: run.routingLock ?? null,
    isValid: isWorkflowRoutingLock,
    field: 'routing lock',
  }),
  routingDecision: stringifyRoutingJson({
    value: run.routingDecision ?? null,
    isValid: isWorkflowRoutingDecision,
    field: 'routing decision',
  }),
  taskProfile: stringifyRoutingJson({
    value: run.taskProfile ?? null,
    isValid: isWorkflowTaskProfile,
    field: 'task profile',
  }),
  generationReservationId: run.generationReservationId ?? null,
});

export const invokeAgentInsert = async (run: AgentInsertArgs): Promise<Agent> => {
  const row = await invoke<RawAgentRow>('agent_insert', {
    input: toAgentInsertPayload({ run }),
  });
  return rowToAgent(row);
};

export type AgentInsertBatchArgs = {
  readonly parentAgentId: AgentId;
  readonly children: ReadonlyArray<AgentInsertArgs>;
};

export type AgentInsertBatchResult = Readonly<{
  inserted: boolean;
  agents: ReadonlyArray<Agent>;
}>;

type RawAgentBatchOutcome = {
  inserted: boolean;
  agents: ReadonlyArray<RawAgentRow>;
};

export const invokeAgentInsertBatch = async ({
  parentAgentId,
  children,
}: AgentInsertBatchArgs): Promise<AgentInsertBatchResult> => {
  const outcome = await invoke<RawAgentBatchOutcome>('agent_insert_batch', {
    input: {
      parentAgentId,
      children: children.map((run) => toAgentInsertPayload({ run })),
    },
  });
  return { inserted: outcome.inserted, agents: outcome.agents.map(rowToAgent) };
};

export type WorkflowNodeRoutingUpdateArgs = {
  readonly nodeKind: 'step' | 'agent';
  readonly id: StepId | AgentId;
  readonly routingLock: WorkflowRoutingLock | null;
  readonly routingDecision: WorkflowRoutingDecision;
  readonly taskProfile: WorkflowTaskProfile | null;
  readonly providerOverride: ProviderId | null;
  readonly modelOverride: string | null;
  readonly effort: AgentEffort | null;
};

export const invokeWorkflowNodeRoutingUpdate = async ({
  nodeKind,
  id,
  routingLock,
  routingDecision,
  taskProfile,
  providerOverride,
  modelOverride,
  effort,
}: WorkflowNodeRoutingUpdateArgs): Promise<void> => {
  await invoke<void>('workflow_node_routing_update', {
    input: {
      nodeKind,
      id,
      routingLock: stringifyRoutingJson({
        value: routingLock,
        isValid: isWorkflowRoutingLock,
        field: 'routing lock',
      }),
      routingDecision: stringifyRoutingJson({
        value: routingDecision,
        isValid: isWorkflowRoutingDecision,
        field: 'routing decision',
      }),
      taskProfile: stringifyRoutingJson({
        value: taskProfile,
        isValid: isWorkflowTaskProfile,
        field: 'task profile',
      }),
      providerOverride,
      modelOverride,
      effort,
    },
  });
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

type Params = {
  readonly id: AgentId;
  readonly providerSessionId: string;
  readonly providerSessionProviderId: ProviderId;
};

export const invokeAgentSetProviderSessionId = async ({
  id,
  providerSessionId,
  providerSessionProviderId,
}: Params): Promise<void> => {
  await invoke<void>('agent_set_provider_session_id', {
    id,
    providerSessionId,
    providerSessionProviderId,
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

export type FreezeClusterGraphParams = {
  readonly containerAgentId: AgentId;
  readonly reason: string;
  readonly obligationId: string | null;
};

export const invokeClusterGraphFreeze = async ({
  containerAgentId,
  reason,
  obligationId,
}: FreezeClusterGraphParams): Promise<ClusterExecutionGraph> => {
  const row = await invoke<RawClusterExecutionGraphRow>('cluster_graph_freeze', {
    input: { containerAgentId, reason, obligationId },
  });
  return executionGraphFromRow({ row });
};

export type AdoptClusterGraphRevisionParams = {
  readonly id: string;
  readonly containerAgentId: AgentId;
  readonly obligationId: string | null;
  readonly fromRevision: number;
  readonly toRevision: number;
  readonly executionVersion: number;
  readonly graphNodes: ReadonlyArray<ClusterGraphNode>;
  readonly reason: string;
  readonly nodes: ReadonlyArray<ClusterExecutionNode>;
  readonly agents: ReadonlyArray<AgentInsertArgs>;
};

export type ClusterGraphRevisionOutcome = Readonly<{
  adopted: boolean;
  graph: ClusterExecutionGraph;
  agents: ReadonlyArray<Agent>;
}>;

export const invokeClusterGraphRevisionAdopt = async ({
  id,
  containerAgentId,
  obligationId,
  fromRevision,
  toRevision,
  executionVersion,
  graphNodes,
  reason,
  nodes,
  agents,
}: AdoptClusterGraphRevisionParams): Promise<ClusterGraphRevisionOutcome> => {
  const outcome = await invoke<{
    readonly adopted: boolean;
    readonly graph: RawClusterExecutionGraphRow;
    readonly agents: ReadonlyArray<RawAgentRow>;
  }>('cluster_graph_revision_adopt', {
    input: {
      id,
      containerAgentId,
      obligationId,
      fromRevision,
      toRevision,
      executionVersion,
      graphJson: JSON.stringify(graphNodes),
      reason,
      nodes,
      agents,
    },
  });
  return {
    adopted: outcome.adopted,
    graph: executionGraphFromRow({ row: outcome.graph }),
    agents: outcome.agents.map((row) => rowToAgent(row)),
  };
};

export type RefuseClusterGraphRevisionParams = {
  readonly id: string;
  readonly containerAgentId: AgentId;
  readonly obligationId: string | null;
  readonly fromRevision: number;
  readonly reason: string;
};

export const invokeClusterGraphRevisionRefuse = async ({
  id,
  containerAgentId,
  obligationId,
  fromRevision,
  reason,
}: RefuseClusterGraphRevisionParams): Promise<ClusterExecutionGraph> => {
  const row = await invoke<RawClusterExecutionGraphRow>('cluster_graph_revision_refuse', {
    input: { id, containerAgentId, obligationId, fromRevision, reason },
  });
  return executionGraphFromRow({ row });
};

type PolishStepParams = {
  readonly deps: Omit<StepPolishDeps, 'invokeFn'>;
  readonly input: StepPolishInput;
};

export const polishWorkflowStep = ({ deps, input }: PolishStepParams): Promise<string | null> =>
  polishStepInstruction({ ...deps, invokeFn: invoke }, input);

type PolishGoalParams = {
  readonly deps: Omit<GoalPolishDeps, 'invokeFn'>;
  readonly goal: string;
};

export const polishWorkflowGoalText = ({ deps, goal }: PolishGoalParams): Promise<string | null> =>
  polishWorkflowGoal({ ...deps, invokeFn: invoke }, goal);

type PlannerParams = {
  readonly deps: Omit<PlannerClientDeps, 'invokeFn'>;
};

export const createWorkflowPlanner = ({ deps }: PlannerParams): PlannerClient =>
  new PlannerClient({ ...deps, invokeFn: invoke });
