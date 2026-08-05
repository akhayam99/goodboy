import type { AgentId, PlanId, SessionId } from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core';
import { inferAgentKindFromName, kindConsumesPlan } from '../../../features/session/agent-kind';
import { pickNextWorkflowStep } from '../../../features/workflows/components/WorkflowNextStepCta';
import type { GetFn } from './types';

export const runPlan = (get: GetFn) => {
  return async (sessionId: SessionId, planId: PlanId): Promise<AgentId | null> => {
    const state = get();

    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session || session.workflowRuns.length === 0) {
      return await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
        focus: 'none',
      });
    }

    const plan = state.sessionPlans[sessionId]?.find((p) => p.id === planId);
    const runs = state.sessionPhaseRuns[sessionId] ?? [];
    const creatorAgent = plan ? runs.find((r) => r.id === plan.agentId) : undefined;
    if (!creatorAgent?.stepId || !creatorAgent.workflowRunId) {
      return await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
        focus: 'none',
      });
    }

    if (creatorAgent.status === 'failed') {
      return null;
    }

    const templates = state.phaseTemplates[session.workspaceId] ?? [];
    const creatorRun = session.workflowRuns.find((r) => r.id === creatorAgent.workflowRunId);
    const template =
      creatorRun && !creatorRun.discardedAt
        ? (templates.find((t) => t.id === creatorRun.workflowId) ?? null)
        : null;
    if (!creatorRun || !template) {
      return await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
        focus: 'none',
      });
    }

    const runAgents = runsForWorkflowRun(runs, creatorRun.id);
    const nextStep = pickNextWorkflowStep(template, runAgents);
    if (!nextStep) {
      return await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
        focus: 'none',
      });
    }

    const nextKind = inferAgentKindFromName(nextStep.name);
    if (!kindConsumesPlan(nextKind)) {
      return await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
        focus: 'none',
      });
    }

    const stepAgent = runAgents.find((r) => r.stepId === nextStep.id && r.status === 'pending');
    if (!stepAgent) {
      return await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
        focus: 'none',
      });
    }
    await get().activateWorkflowAgent({
      sessionId,
      agentId: stepAgent.id,
      explicitPlanId: planId,
      focus: 'none',
    });
    return stepAgent.id;
  };
};
