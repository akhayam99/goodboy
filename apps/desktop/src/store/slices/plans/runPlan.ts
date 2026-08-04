import type { PlanId, SessionId } from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core';
import { inferAgentKindFromName, kindConsumesPlan } from '../../../features/session/agent-kind';
import { pickNextWorkflowStep } from '../../../features/workflows/components/WorkflowNextStepCta';
import type { GetFn } from './types';

export const runPlan = (get: GetFn) => {
  return async (sessionId: SessionId, planId: PlanId) => {
    const state = get();

    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session || session.workflowRuns.length === 0) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
        focus: 'agent',
      });
      return;
    }

    const plan = state.sessionPlans[sessionId]?.find((p) => p.id === planId);
    const runs = state.sessionPhaseRuns[sessionId] ?? [];
    const creatorAgent = plan ? runs.find((r) => r.id === plan.agentId) : undefined;
    if (!creatorAgent?.stepId || !creatorAgent.workflowRunId) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
        focus: 'agent',
      });
      return;
    }

    if (creatorAgent.status === 'failed') {
      return;
    }

    const templates = state.phaseTemplates[session.workspaceId] ?? [];
    const creatorRun = session.workflowRuns.find((r) => r.id === creatorAgent.workflowRunId);
    const template =
      creatorRun && !creatorRun.discardedAt
        ? (templates.find((t) => t.id === creatorRun.workflowId) ?? null)
        : null;
    if (!creatorRun || !template) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
        focus: 'agent',
      });
      return;
    }

    const runAgents = runsForWorkflowRun(runs, creatorRun.id);
    const nextStep = pickNextWorkflowStep(template, runAgents);
    if (!nextStep) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
        focus: 'agent',
      });
      return;
    }

    const nextKind = inferAgentKindFromName(nextStep.name);
    if (!kindConsumesPlan(nextKind)) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
        focus: 'agent',
      });
      return;
    }

    const stepAgent = runAgents.find((r) => r.stepId === nextStep.id && r.status === 'pending');
    if (!stepAgent) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
        focus: 'agent',
      });
      return;
    }
    await get().activateWorkflowAgent(sessionId, stepAgent.id, planId, 'agent');
  };
};
