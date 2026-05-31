import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import {
  addPlanConsumption as invokeAddPlanConsumption,
  listConsumptionsForPlan as invokeListConsumptionsForPlan,
  listPlansForSession as invokeListPlansForSession,
} from '../../../features/plans/plans';
import { inferAgentKindFromName, type AgentKind } from '../../../features/session/agent-kind';
import { buildPlanKickoffSection, composeKickoff } from '../../kickoff';
import { fanOutClusters } from './clusterImplementation';
import type { GetFn, SetFn } from './types';

export function activateWorkflowAgent(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, agentId: AgentId) => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const agent = runs.find((r) => r.id === agentId);
    if (!agent || !agent.stepId) throw new Error('agent not found or not a workflow agent');

    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || session.workflowIds.length === 0) {
      throw new Error('session has no workflow');
    }

    // Look up the template that owns this agent's stepId. Multi-workflow
    // sessions can attach >1 workflow, so hardcoding `workflowIds[0]` would
    // route step lookups for workflow #2+ agents into workflow #1's template,
    // silently producing an empty kickoff (kickoff.length === 0 → sendTurn
    // never fires → the lit row appears unresponsive on click).
    const templates = get().phaseTemplates[session.workspaceId] ?? [];
    const template =
      templates.find(
        (t) => session.workflowIds.includes(t.id) && t.steps.some((s) => s.id === agent.stepId),
      ) ?? null;
    const step = template?.steps.find((s) => s.id === agent.stepId);
    const promptPrefix = step?.promptPrefix ?? '';

    set((s) => ({
      selectedAgentId: { ...s.selectedAgentId, [sessionId]: agentId },
      agentTurnState: {
        ...s.agentTurnState,
        [agentId]: {
          kind: 'idle' as const,
          lastActivityAt: new Date().toISOString() as IsoDateTime,
        },
      },
    }));

    const effectiveKind: AgentKind =
      (agent.kind as AgentKind | undefined) ?? inferAgentKindFromName(agent.name);
    const isImplementer = effectiveKind === 'implementer';
    const { section: planSection, plan: latestPlan } = isImplementer
      ? await buildPlanKickoffSection(sessionId)
      : { section: '', plan: null };

    if (isImplementer && latestPlan && latestPlan.status === 'active') {
      await invokeAddPlanConsumption(latestPlan.id, agentId);
      const refreshedPlans = await invokeListPlansForSession(sessionId);
      const consumptions = await invokeListConsumptionsForPlan(latestPlan.id);
      set((state) => ({
        sessionPlans: { ...state.sessionPlans, [sessionId]: refreshedPlans },
        planConsumptions: { ...state.planConsumptions, [latestPlan.id]: consumptions },
      }));
    }

    const clusters =
      isImplementer && latestPlan?.status === 'active' ? latestPlan.clusters : undefined;
    if (clusters && clusters.length >= 2) {
      await fanOutClusters(set, get, sessionId, agent, clusters, latestPlan!.title);
      return;
    }

    const kickoff = composeKickoff(planSection, promptPrefix);
    if (kickoff.length > 0) {
      void get().sendTurn({ sessionId, agentId, content: kickoff });
    }
  };
}
