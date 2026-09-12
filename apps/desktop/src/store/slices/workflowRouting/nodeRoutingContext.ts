import type {
  Agent,
  AgentRole,
  ProviderId,
  RoleModelPreferences,
  SessionId,
  Step,
  WorkflowModelPick,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowTaskProfile,
} from '@goodboy/types';
import {
  defaultsForRole,
  resolveRoleRouting,
  type WorkflowRoutingAvailabilitySnapshot,
  type WorkflowRoutingProposalParseOutcome,
} from '@goodboy/core';
import {
  KIND_TO_ROLE,
  inferAgentKindFromName,
  type AgentKind,
} from '../../../features/session/agent-kind';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import { roleModelsForSession } from '../overrides/roleModelsForSession';
import type { AppStore } from '../../store';
import type { WorkflowRoutingNodeRef } from './types';
import { isWorkflowNodeRoutingMutable } from './workflowNodeRoutingMutability';

const UNKNOWN_PROFILE: WorkflowTaskProfile = {
  taskType: 'general',
  difficulty: 'unknown',
  basis: 'unknown',
};

type ConfiguredRoleParams = {
  readonly role: AgentRole | null;
  readonly roleModels: RoleModelPreferences | null | undefined;
};

const configuredRolePick = ({
  role,
  roleModels,
}: ConfiguredRoleParams): WorkflowModelPick | null => {
  if (role === null) {
    return null;
  }
  const routing = resolveRoleRouting({ role, prefs: roleModels });
  if (routing.isOverride === false) {
    return null;
  }
  return { provider: routing.provider, model: routing.model, effort: routing.effort };
};

export type WorkflowNodeRoutingContext = Readonly<{
  agent: Agent | null;
  step: Step | null;
  role: AgentRole | null;
  isMutable: boolean;
  lock: WorkflowRoutingLock | null;
  decision: WorkflowRoutingDecision | null;
  taskProfile: WorkflowTaskProfile | null;
  proposal: WorkflowRoutingProposalParseOutcome;
  runRoleLock: WorkflowModelPick | null;
  roleDefault: WorkflowModelPick | null;
  sessionDefault: WorkflowModelPick | null;
  kindDefault: WorkflowModelPick | null;
  availability: WorkflowRoutingAvailabilitySnapshot;
}>;

type Params = WorkflowRoutingNodeRef & {
  readonly state: AppStore;
  readonly sessionId: SessionId;
};

type NodeRecords = Readonly<{
  agent: Agent | null;
  step: Step | null;
}>;

const findRecords = ({ state, sessionId, nodeKind, id }: Params): NodeRecords => {
  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  const workflows = state.sessionWorkflows[sessionId] ?? [];
  if (nodeKind === 'agent') {
    const agent = agents.find((candidate) => candidate.id === id) ?? null;
    const stepId = agent?.stepId ?? null;
    const step =
      stepId === null
        ? null
        : (workflows.flatMap((workflow) => workflow.steps).find((entry) => entry.id === stepId) ??
          null);
    return { agent, step };
  }
  const step =
    workflows.flatMap((workflow) => workflow.steps).find((entry) => entry.id === id) ?? null;
  return { agent: null, step };
};

type ProposalParams = {
  readonly decision: WorkflowRoutingDecision | null;
  readonly taskProfile: WorkflowTaskProfile | null;
};

const proposalOutcome = ({
  decision,
  taskProfile,
}: ProposalParams): WorkflowRoutingProposalParseOutcome => {
  const proposal = decision?.proposal ?? null;
  if (proposal === null) {
    return { kind: 'missing', profile: taskProfile ?? UNKNOWN_PROFILE };
  }
  return { kind: 'valid', proposal };
};

export const workflowNodeRoutingContext = ({
  state,
  sessionId,
  nodeKind,
  id,
}: Params): WorkflowNodeRoutingContext | null => {
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (session == null) {
    return null;
  }
  const { agent, step } = findRecords({ state, sessionId, nodeKind, id });
  if (agent === null && step === null) {
    return null;
  }
  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  const kind: AgentKind =
    agent === null
      ? 'generic'
      : ((state.agentKindOverride[agent.id] ??
          agent.kind ??
          inferAgentKindFromName(agent.name)) as AgentKind);
  const role = step?.role ?? (agent === null ? null : KIND_TO_ROLE[kind]);
  const run =
    agent?.workflowRunId == null
      ? null
      : (session.workflowRuns.find((candidate) => candidate.id === agent.workflowRunId) ?? null);
  const workspaceRoleModels = roleModelsForSession({ state, sessionId });
  const compiled = role === null ? null : defaultsForRole(role);
  const defaultProvider = (session.providerOverride ??
    session.providerPreference.defaultProvider) as ProviderId;
  const lock = agent?.routingLock ?? step?.routingLock ?? null;
  const decision = agent?.routingDecision ?? step?.routingDecision ?? null;
  const taskProfile = agent?.taskProfile ?? step?.taskProfile ?? null;
  return {
    agent,
    step,
    role,
    isMutable: isWorkflowNodeRoutingMutable({ nodeKind, agent, step, agents }),
    lock,
    decision,
    taskProfile,
    proposal: proposalOutcome({ decision, taskProfile }),
    runRoleLock: configuredRolePick({ role, roleModels: run?.roleModelOverrides ?? null }),
    roleDefault: configuredRolePick({ role, roleModels: workspaceRoleModels }),
    sessionDefault:
      session.modelOverride == null
        ? null
        : {
            provider: defaultProvider,
            model: session.modelOverride,
            effort: session.effort ?? null,
          },
    kindDefault:
      compiled === null
        ? null
        : { provider: compiled.provider, model: compiled.model, effort: compiled.effort },
    availability: workflowAvailabilitySnapshot({
      providers: state.providers ?? [],
      cooldowns: state.providerCooldowns ?? {},
      alerts: state.budgetAlerts ?? [],
      sessionId,
      isRunBudgetBlocked: false,
      nowMs: Date.now(),
    }),
  };
};
