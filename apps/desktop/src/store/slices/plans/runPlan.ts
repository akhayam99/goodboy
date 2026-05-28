import type { PlanId, SessionId } from '@goodboy/types';
import { AGENT_KIND_DEFAULTS, inferAgentKindFromName } from '../../../features/session/agent-kind';
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
    if (!session || session.workflowIds.length === 0) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
      });
      return;
    }

    // B: plan must have been created inside a workflow (creator agent has a stepId)
    const plan = state.sessionPlans[sessionId]?.find((p) => p.id === planId);
    const runs = state.sessionPhaseRuns[sessionId] ?? [];
    const creatorAgent = plan ? runs.find((r) => r.id === plan.agentId) : undefined;
    if (!creatorAgent?.stepId) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
      });
      return;
    }

    // C: resolve which attached workflow owns the creator step, that workflow is
    // the routing context. Without a match we fall back to free-spawn.
    const templates = state.phaseTemplates[session.workspaceId] ?? [];
    const attached = session.workflowIds
      .map((wid) => templates.find((t) => t.id === wid))
      .filter((t): t is NonNullable<typeof t> => t !== undefined);
    const template =
      attached.find((t) => t.steps.some((s) => s.id === creatorAgent.stepId)) ?? null;
    if (!template) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
      });
      return;
    }

    // D: there must be a next step ready to run
    const nextStep = pickNextWorkflowStep(template, runs);
    if (!nextStep) {
      await get().spawnAgent(sessionId, {
        triggeredPlanId: planId,
        kindOverride: 'implementer',
      });
      return;
    }

    // E: next step must be an implementer, don't hijack reviewer/tester/etc.
    if (inferAgentKindFromName(nextStep.name) !== 'implementer') {
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
      triggeredPlanId: planId,
      model: AGENT_KIND_DEFAULTS.implementer.model,
    });
  };
}
