import { isAgentStatusSettled, runsForWorkflowRun } from '@goodboy/core';
import type {
  Agent,
  OpenQuestion,
  PlanWithCount,
  Session,
  Workflow,
  WorkflowRun,
} from '@goodboy/types';
import { useAppStore, useRunSpendUsd } from '../../../../../store';
import {
  heldAdmissionBlock,
  isRunHeldForPlan,
} from '../../../../../store/slices/workflows/workflowPlanApproval';
import { useSessionAgentTree } from '../useSessionAgentTree';
import { useAgentMetrics } from '../../../hooks/useAgentMetrics';
import { workflowKindName } from '../../../../workspace/components/WorkspacesSidebar/lib';
import type { WorkflowBlockReason } from '../../../../workflows/advanceGate';
import { isRunPaused } from '../../../../workflows/isRunPaused';
import { isWorkflowRunClosable } from '../../../../workflows/isWorkflowRunClosable';
import { isWorkflowRunClosedByUser } from '../../../../workflows/isWorkflowRunClosedByUser';
import {
  runPrimaryOf,
  type RunFlow,
  type RunPlanHold,
  type RunPrimary,
} from '../../../../workflows/runPrimaryOf';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import {
  useOrchestratorState,
  type OrchestratorView,
} from '../../../../workflows/useOrchestratorState';
import { useRunPlan } from '../../../../workflows/useRunPlan';
import { useWorkflowRunAdvance } from '../../../../workflows/hooks/useWorkflowRunAdvance';
import { viewWorkflowAdvance } from '../../../../workflows/workflowAdvanceView';

const NO_AGENTS: ReadonlyArray<Agent> = [];

type Params = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

export type RunView = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly name: string;
  readonly agents: ReadonlyArray<Agent>;
  readonly isDiscarded: boolean;
  readonly isDynamic: boolean;
  readonly isCompleted: boolean;
  readonly isClosable: boolean;
  readonly isOrchestrating: boolean;
  readonly isQueuedManual: boolean;
  readonly stepCount: number;
  readonly doneCount: number;
  readonly agentCount: number;
  readonly costUsd: number;
  readonly blockReason: WorkflowBlockReason | null;
  readonly plan: PlanWithCount | null;
  readonly orchestrator: OrchestratorView;
  readonly answerQuestion: OpenQuestion | null;
  readonly nextStepAgent: Agent | null;
  readonly predecessorName: string;
  readonly primary: RunPrimary | null;
};

type CountParams = {
  readonly agent: Agent;
  readonly childrenByParentId: ReadonlyMap<string, ReadonlyArray<Agent>>;
};

const countAgentTree = ({ agent, childrenByParentId }: CountParams): number =>
  (childrenByParentId.get(agent.id) ?? []).reduce(
    (sum, child) => sum + countAgentTree({ agent: child, childrenByParentId }),
    1,
  );

type HoldParams = {
  readonly run: WorkflowRun;
  readonly plan: PlanWithCount | null;
};

const holdOf = ({ run, plan }: HoldParams): RunPlanHold => {
  if (!isRunHeldForPlan({ run })) {
    return 'none';
  }
  return plan === null ? 'without-plan' : 'with-plan';
};

export const useRunView = ({ session, run, workflow }: Params): RunView => {
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const phaseRuns = useAppStore((state) => state.sessionPhaseRuns[session.id] ?? NO_AGENTS);
  const tree = useSessionAgentTree({ phaseRuns });
  const { aggregatesByAgentId } = useAgentMetrics({ sessionId: session.id });
  const spendUsd = useRunSpendUsd(session.id, run.id);
  const isOrchestrating = useAppStore(
    (state) => state.orchestratingWorkflowRuns?.[run.id] ?? false,
  );
  const plan = useRunPlan({ sessionId: session.id, runId: run.id });
  const advance = useWorkflowRunAdvance({ sessionId: session.id, run, workflow });
  const agents = tree.agentsByRunId.get(run.id) ?? NO_AGENTS;
  const isDynamic = run.executionMode === 'dynamic';
  const aggregateCostUsd = agents.reduce(
    (total, agent) => total + (aggregatesByAgentId.get(agent.id)?.estimatedCostUsd ?? 0),
    0,
  );
  const costUsd = isDynamic ? spendUsd : aggregateCostUsd;
  const orchestrator = useOrchestratorState({
    sessionId: session.id,
    run,
    agents,
    plan,
    isOrchestrating,
    costUsd,
  });
  const view = viewWorkflowAdvance({ state: advance.state });
  const isDiscarded = run.discardedAt != null;
  const stepCount = workflow.steps.length;
  const doneCount = agents.filter((agent) => isAgentStatusSettled({ status: agent.status })).length;
  const isClosed = isWorkflowRunClosedByUser({ run });
  const isCompleted =
    !isDiscarded &&
    (isClosed ||
      (isDynamic ? run.orchestrationOutcome === 'done' : stepCount > 0 && doneCount >= stepCount));
  const isQueuedManual = !isDiscarded && run.triggerMode === 'manual' && agents.length === 0;
  const nextStep = isDiscarded || isDynamic ? null : view.chainStep;
  const nextStepAgent =
    nextStep === null
      ? null
      : (agents.find((agent) => agent.stepId === nextStep.id && agent.status === 'pending') ??
        null);
  const nextStepIndex =
    nextStep === null || nextStepAgent === null
      ? -1
      : [...workflow.steps]
          .sort((first, second) => first.ordinal - second.ordinal)
          .findIndex((step) => step.id === nextStep.id);
  const flow: RunFlow = isDynamic
    ? {
        kind: 'dynamic',
        phase: orchestrator.state.phase,
        hasQuestion:
          orchestrator.state.phase === 'plan-question'
            ? orchestrator.planQuestion !== null
            : orchestrator.runQuestion !== null,
        isAutoRun: run.autoRun === true,
      }
    : {
        kind: 'static',
        isPaused: isRunPaused({ run }),
        nextStepNumber: nextStepIndex < 0 ? null : nextStepIndex + 1,
      };
  const predecessor =
    run.chainAfterId == null
      ? null
      : (attachedRuns.find((candidate) => candidate.run.id === run.chainAfterId) ?? null);

  return {
    run,
    workflow,
    name: run.title ?? workflowKindName(workflow),
    agents,
    isDiscarded,
    isDynamic,
    isCompleted,
    isClosable: isWorkflowRunClosable({
      run,
      workflow,
      agents: runsForWorkflowRun(phaseRuns, run.id),
    }),
    isOrchestrating,
    isQueuedManual,
    stepCount,
    doneCount,
    agentCount: agents.reduce(
      (sum, agent) => sum + countAgentTree({ agent, childrenByParentId: tree.childrenByParentId }),
      0,
    ),
    costUsd,
    blockReason: heldAdmissionBlock({ run }) ?? view.blockReason,
    plan,
    orchestrator,
    answerQuestion:
      orchestrator.state.phase === 'plan-question'
        ? orchestrator.planQuestion
        : orchestrator.runQuestion,
    nextStepAgent,
    predecessorName:
      predecessor === null
        ? 'previous'
        : (predecessor.run.title ?? workflowKindName(predecessor.workflow)),
    primary: runPrimaryOf({
      isDiscarded,
      isFinished: isCompleted,
      isQueuedManual,
      hold: holdOf({ run, plan }),
      flow,
    }),
  };
};
