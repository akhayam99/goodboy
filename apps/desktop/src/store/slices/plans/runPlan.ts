import type { PlanId, SessionId, WorkflowRunId } from '@goodboy/types';
import { isAgentStatusHalted, runsForWorkflowRun } from '@goodboy/core';
import { classifyStep, kindConsumesPlan } from '../../../features/session/agent-kind';
import { resolveWorkflowAdvance } from '../../../features/workflows/advanceGate';
import { viewWorkflowAdvance } from '../../../features/workflows/workflowAdvanceView';
import { PLAN_REVISING_REASON, planRevisingOf } from '../../../features/plans/planRevising';
import { activateWorkflowAgentOrNotify } from '../workflows/activateWorkflowAgentOrNotify';
import type { GetFn, RunPlanResult } from './types';
import { sessionById } from '../sessions/sessionIndex';

const refused = ({
  reason,
  workflowRunId = null,
}: {
  readonly reason: string | null;
  readonly workflowRunId?: WorkflowRunId | null;
}): RunPlanResult => ({ kind: 'refused', reason, workflowRunId });

export const runPlan = (get: GetFn) => {
  return async (sessionId: SessionId, planId: PlanId): Promise<RunPlanResult> => {
    const state = get();

    const spawnImplementer = () =>
      get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
        focus: 'none',
      });
    const startOutside = async (note: string): Promise<RunPlanResult> => ({
      kind: 'startedOutside',
      agentId: await spawnImplementer(),
      note,
    });

    const stored = state.sessionArtifacts[sessionId]?.find((artifact) => artifact.id === planId);
    if (
      stored !== undefined &&
      planRevisingOf({ artifact: stored, turn: state.agentTurnState[stored.agentId] }).kind ===
        'revising'
    ) {
      return refused({ reason: PLAN_REVISING_REASON });
    }

    const session = sessionById(state.sessions, sessionId);
    if (!session || session.workflowRuns.length === 0) {
      return { kind: 'started', agentId: await spawnImplementer(), scope: 'session' };
    }

    const plan = state.sessionPlans[sessionId]?.find((p) => p.id === planId);
    const runs = state.sessionPhaseRuns[sessionId] ?? [];
    const creatorAgent = plan ? runs.find((r) => r.id === plan.agentId) : undefined;
    if (!creatorAgent?.stepId || !creatorAgent.workflowRunId) {
      return { kind: 'started', agentId: await spawnImplementer(), scope: 'session' };
    }

    const workflowRunId = creatorAgent.workflowRunId;
    if (isAgentStatusHalted({ status: creatorAgent.status })) {
      return refused({
        reason: 'The planner stopped before finishing, so this plan cannot run yet',
        workflowRunId,
      });
    }

    const templates = state.phaseTemplates[session.workspaceId] ?? [];
    const creatorRun = session.workflowRuns.find((r) => r.id === workflowRunId);
    if (!creatorRun || creatorRun.discardedAt) {
      return await startOutside('Started outside the run, it was discarded');
    }
    const template = templates.find((t) => t.id === creatorRun.workflowId);
    if (!template) {
      return await startOutside('Started outside the run, its workflow is no longer available');
    }

    const runAgents = runsForWorkflowRun(runs, creatorRun.id);
    const { chainStep: nextStep } = viewWorkflowAdvance({
      state: resolveWorkflowAdvance({
        workflow: template,
        agents: runAgents,
        hasOpenQuestions: false,
        isSummarizerRunning: false,
        isTurnRunning: false,
      }),
    });
    if (!nextStep) {
      return refused({
        reason: 'The run has no step left for this plan',
        workflowRunId: creatorRun.id,
      });
    }

    const nextKind = classifyStep({ step: nextStep });
    if (!kindConsumesPlan({ kind: nextKind })) {
      return refused({
        reason: `The next step (${nextStep.name}) does not run plans`,
        workflowRunId: creatorRun.id,
      });
    }

    const stepAgent = runAgents.find((r) => r.stepId === nextStep.id && r.status === 'pending');
    if (!stepAgent) {
      return refused({
        reason: `Step ${nextStep.ordinal + 1} already started`,
        workflowRunId: creatorRun.id,
      });
    }
    const activated = await activateWorkflowAgentOrNotify({
      get,
      sessionId,
      agentId: stepAgent.id,
      explicitPlanId: planId,
      focus: 'none',
    });
    return activated
      ? { kind: 'started', agentId: stepAgent.id, scope: 'workflow' }
      : refused({ reason: null, workflowRunId: creatorRun.id });
  };
};
