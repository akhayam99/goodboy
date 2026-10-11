import type {
  Agent,
  AgentRole,
  ProviderId,
  SessionId,
  Step,
  WorkflowModelPick,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowTaskProfile,
} from '@goodboy/types';
import {
  type WorkflowRoutingAvailabilitySnapshot,
  type WorkflowRoutingProposalParseOutcome,
} from '@goodboy/core';
import { KIND_TO_ROLE, classifyAgent, type AgentKind } from '../../../features/session/agent-kind';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import { workspacePolicyAvailability } from '../providerLimits/workspacePolicyAvailability';
import type { AppStore } from '../../store';
import type { WorkflowRoutingNodeRef } from './types';
import { isWorkflowNodeRoutingMutable } from './workflowNodeRoutingMutability';
import { sessionById } from '../sessions/sessionIndex';
import { rolePicks } from './rolePicks';
import { selectHiddenModels } from '../settings/selectHiddenModels';

const UNKNOWN_PROFILE: WorkflowTaskProfile = {
  taskType: 'general',
  difficulty: 'unknown',
  basis: 'unknown',
};

type WorkflowNodeRoutingContext = Readonly<{
  agent: Agent | null;
  step: Step | null;
  role: AgentRole | null;
  isMutable: boolean;
  lock: WorkflowRoutingLock | null;
  decision: WorkflowRoutingDecision | null;
  taskProfile: WorkflowTaskProfile | null;
  proposal: WorkflowRoutingProposalParseOutcome;
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
  const session = sessionById(state.sessions, sessionId);
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
      : classifyAgent({ agent, override: state.agentKindOverride[agent.id] ?? null });
  const role = step?.role ?? (agent === null ? null : KIND_TO_ROLE[kind]);
  const defaultProvider = (session.providerOverride ??
    session.providerPreference.defaultProvider) as ProviderId;
  const taskProfile = agent?.taskProfile ?? step?.taskProfile ?? null;
  const picks =
    role === null
      ? null
      : rolePicks({ state, sessionId, role, size: step?.size ?? null, profile: taskProfile });
  const lock = agent?.routingLock ?? step?.routingLock ?? null;
  const decision = agent?.routingDecision ?? step?.routingDecision ?? null;
  return {
    agent,
    step,
    role,
    isMutable: isWorkflowNodeRoutingMutable({ nodeKind, agent, step, agents }),
    lock,
    decision,
    taskProfile,
    proposal: proposalOutcome({ decision, taskProfile }),
    roleDefault: picks?.roleDefault ?? null,
    sessionDefault:
      session.modelOverride == null
        ? null
        : {
            provider: defaultProvider,
            model: session.modelOverride,
            effort: session.effort ?? null,
          },
    kindDefault: picks?.kindDefault ?? null,
    availability: workflowAvailabilitySnapshot({
      providers: state.providers ?? [],
      cooldowns: state.providerCooldowns ?? {},
      alerts: state.budgetAlerts ?? [],
      hidden: selectHiddenModels({ state: state }),
      sessionId,
      isRunBudgetBlocked: false,
      nowMs: Date.now(),
      ...workspacePolicyAvailability({ state, sessionId }),
    }),
  };
};
