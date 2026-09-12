import type {
  Agent,
  Step,
  WorkflowModelPick,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowRoutingProposal,
} from '@goodboy/types';
import {
  WORKFLOW_ROUTING_COPY,
  WORKFLOW_ROUTING_SOURCE_LABEL,
  WORKFLOW_TASK_DIFFICULTY_LABEL,
} from '../../../features/workflows/workflowRoutingCopy';
import { isWorkflowNodeRoutingMutable } from './workflowNodeRoutingMutability';

export type WorkflowNodeRoutingView = Readonly<{
  selected: WorkflowModelPick | null;
  executed: WorkflowModelPick | null;
  proposal: WorkflowRoutingProposal | null;
  sourceLabel: string;
  reason: string;
  difficultyLabel: string | null;
  isLocked: boolean;
  isLegacy: boolean;
  isMutable: boolean;
  isPending: boolean;
  error: string | null;
}>;

type Params = {
  readonly agent: Agent;
  readonly step: Step | null;
  readonly isPending: boolean;
  readonly error: string | null;
};

type FallbackParams = {
  readonly agent: Agent;
};

const agentPick = ({ agent }: FallbackParams): WorkflowModelPick | null => {
  if (agent.providerOverride == null || agent.modelOverride == null) {
    return null;
  }
  return {
    provider: agent.providerOverride,
    model: agent.modelOverride,
    effort: agent.effort ?? null,
  };
};

type LabelParams = {
  readonly lock: WorkflowRoutingLock | null;
  readonly decision: WorkflowRoutingDecision | null;
};

const sourceLabelFor = ({ lock, decision }: LabelParams): string => {
  if (lock !== null) {
    return lock.origin === 'legacy'
      ? WORKFLOW_ROUTING_COPY.legacyLabel
      : WORKFLOW_ROUTING_COPY.lockedLabel;
  }
  if (decision === null) {
    return WORKFLOW_ROUTING_COPY.automaticLabel;
  }
  return WORKFLOW_ROUTING_SOURCE_LABEL[decision.source];
};

export const selectWorkflowNodeRouting = ({
  agent,
  step,
  isPending,
  error,
}: Params): WorkflowNodeRoutingView => {
  const lock = agent.routingLock ?? step?.routingLock ?? null;
  const decision = agent.routingDecision ?? step?.routingDecision ?? null;
  const profile = agent.taskProfile ?? step?.taskProfile ?? decision?.proposal?.profile ?? null;
  const isLegacy = lock?.origin === 'legacy' || decision?.source === 'legacy';
  return {
    selected: lock?.pick ?? decision?.selected ?? agentPick({ agent }),
    executed: decision?.executed ?? null,
    proposal: decision?.proposal ?? null,
    sourceLabel: sourceLabelFor({ lock, decision }),
    reason: decision?.reason ?? '',
    difficultyLabel: profile === null ? null : WORKFLOW_TASK_DIFFICULTY_LABEL[profile.difficulty],
    isLocked: lock !== null,
    isLegacy,
    isMutable: isWorkflowNodeRoutingMutable({ nodeKind: 'agent', agent, step, agents: [] }),
    isPending,
    error,
  };
};
