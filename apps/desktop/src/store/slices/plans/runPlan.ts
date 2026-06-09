import type { PlanId, SessionId } from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core';
import { inferAgentKindFromName, kindConsumesPlan } from '../../../features/session/agent-kind';
import { pickNextWorkflowStep } from '../../../features/workflows/components/WorkflowNextStepCta';
import type { GetFn } from './types';

// Free-spawn path: force the agent to be an implementer so spawnAgent injects
// the plan body into the kickoff prompt. Without kindOverride the agent
// defaults to 'generic' and the plan section is silently dropped (the
// implementer branch in spawnAgent is the only one that builds it).
// In-workflow path: the next step already has a pre-created pending agent, so
// activate that slot (routing the chosen plan) instead of inserting a duplicate.
export const runPlan = (get: GetFn) => {
  return async (sessionId: SessionId, planId: PlanId) => {
    const state = get();

    // A: workflow-aware only if session has at least one attached workflow
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session || session.workflowRuns.length === 0) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
      });
      return;
    }

    // B: plan must have been created inside a workflow run (creator agent has one)
    const plan = state.sessionPlans[sessionId]?.find((p) => p.id === planId);
    const runs = state.sessionPhaseRuns[sessionId] ?? [];
    const creatorAgent = plan ? runs.find((r) => r.id === plan.agentId) : undefined;
    if (!creatorAgent?.stepId || !creatorAgent.workflowRunId) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
      });
      return;
    }

    // C: resolve the run instance the creator belongs to, that instance is the
    // routing context. Without a live run/template we fall back to free-spawn.
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
      });
      return;
    }

    // D: there must be a next step ready to run, scoped to this run instance
    const runAgents = runsForWorkflowRun(runs, creatorRun.id);
    const nextStep = pickNextWorkflowStep(template, runAgents);
    if (!nextStep) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
      });
      return;
    }

    // E: next step must execute the plan, don't hijack reviewer/scout/tester/docs.
    const nextKind = inferAgentKindFromName(nextStep.name);
    if (!kindConsumesPlan(nextKind)) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
      });
      return;
    }

    const stepAgent = runAgents.find((r) => r.stepId === nextStep.id && r.status === 'pending');
    if (!stepAgent) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
      });
      return;
    }
    await get().activateWorkflowAgent(sessionId, stepAgent.id, planId);
  };
};
