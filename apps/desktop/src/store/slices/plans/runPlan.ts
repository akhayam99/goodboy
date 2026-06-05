import type { PlanId, SessionId } from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core';
import {
  AGENT_KIND_DEFAULTS,
  inferAgentKindFromName,
  kindConsumesPlan,
} from '../../../features/session/agent-kind';
import { pickNextWorkflowStep } from '../../../features/workflows/components/WorkflowNextStepCta';
import type { GetFn } from './types';

// Force the spawned agent to be an implementer so spawnAgent injects the
// plan body into the kickoff prompt. Without kindOverride the agent
// defaults to 'generic' and the plan section is silently dropped (the
// implementer branch in spawnAgent is the only one that builds it).
// Inside a workflow, if the next step is itself an implementer slot, we
// route the spawn into that slot (stepId) instead of free-spawning.
export function runPlan(get: GetFn) {
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

    // In-workflow spawn: stepId routes the agent into the workflow slot.
    // triggeredPlanId → explicit plan injected + consumed by spawnAgent.
    // No kindOverride: kind resolved by inferAgentKindFromName(step.name).
    await get().spawnAgent(sessionId, {
      stepId: nextStep.id,
      workflowRunId: creatorRun.id,
      triggeredPlanId: planId,
      model: AGENT_KIND_DEFAULTS[nextKind].model,
    });
  };
}
