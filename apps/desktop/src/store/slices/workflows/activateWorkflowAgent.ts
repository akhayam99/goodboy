import type { AgentId, IsoDateTime, PlanId, SessionId } from '@goodboy/types';
import {
  addPlanConsumption as invokeAddPlanConsumption,
  listConsumptionsForPlan as invokeListConsumptionsForPlan,
  listPlansForSession as invokeListPlansForSession,
} from '../../../features/plans/plans';
import {
  inferAgentKindFromName,
  kindConsumesPlan,
  type AgentKind,
} from '../../../features/session/agent-kind';
import {
  buildGoalKickoffSection,
  buildPlanKickoffSection,
  composeKickoff,
  composeStepBoundary,
} from '../../kickoff';
import { fanOutClusters, selectFanOutPlan } from './clusterImplementation';
import type { GetFn, SetFn } from './types';

export const activateWorkflowAgent = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    agentId: AgentId,
    explicitPlanId?: PlanId,
    navigate = true,
  ) => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const agent = runs.find((r) => r.id === agentId);
    if (!agent || !agent.stepId) {
      throw new Error('agent not found or not a workflow agent');
    }

    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || session.workflowRuns.length === 0) {
      throw new Error('session has no workflow');
    }

    const run = session.workflowRuns.find((r) => r.id === agent.workflowRunId);
    const templates = get().phaseTemplates[session.workspaceId] ?? [];
    const template = run ? (templates.find((t) => t.id === run.workflowId) ?? null) : null;
    const step = template?.steps.find((s) => s.id === agent.stepId);
    const promptPrefix = step?.promptPrefix ?? '';
    const goalSection = buildGoalKickoffSection(run?.goal ?? template?.goal);

    set((s) => ({
      agentTurnState: {
        ...s.agentTurnState,
        [agentId]: {
          kind: 'idle' as const,
          lastActivityAt: new Date().toISOString() as IsoDateTime,
        },
      },
      ...(navigate ? { selectedAgentId: { ...s.selectedAgentId, [sessionId]: agentId } } : {}),
    }));

    const effectiveKind: AgentKind =
      (agent.kind as AgentKind | undefined) ?? inferAgentKindFromName(agent.name);
    const consumesPlan = kindConsumesPlan(effectiveKind);
    const explicitPlan =
      explicitPlanId !== undefined
        ? (get().sessionPlans[sessionId]?.find((p) => p.id === explicitPlanId) ?? null)
        : null;
    const { section: latestSection, plan: latestPlan } =
      consumesPlan && !explicitPlan
        ? await buildPlanKickoffSection(sessionId, agent.workflowRunId)
        : { section: '', plan: null };

    const planSection = consumesPlan
      ? explicitPlan
        ? ['Active plan to execute:', '', explicitPlan.bodyMd].join('\n')
        : latestSection
      : '';
    const planToConsume = explicitPlan ?? (latestPlan?.status === 'active' ? latestPlan : null);

    const fanOutPlan =
      effectiveKind === 'implementer'
        ? selectFanOutPlan(get, sessionId, {
            workflowRunId: agent.workflowRunId,
            explicitPlan,
          })
        : null;

    if (consumesPlan && planToConsume) {
      await invokeAddPlanConsumption(planToConsume.id, agentId);
      const refreshedPlans = await invokeListPlansForSession(sessionId);
      const consumptions = await invokeListConsumptionsForPlan(planToConsume.id);
      set((state) => ({
        sessionPlans: { ...state.sessionPlans, [sessionId]: refreshedPlans },
        planConsumptions: { ...state.planConsumptions, [planToConsume.id]: consumptions },
      }));
    }

    const clusters =
      fanOutPlan?.clusters && fanOutPlan.clusters.length >= 2 ? fanOutPlan.clusters : undefined;
    if (clusters && clusters.length >= 2) {
      await fanOutClusters(set, get, sessionId, agent, clusters, fanOutPlan!.title);
      return;
    }

    const kickoff = composeKickoff(
      goalSection,
      planSection,
      promptPrefix,
      composeStepBoundary(agentId),
    );
    if (kickoff.length > 0) {
      void get().sendTurn({ sessionId, agentId, content: kickoff });
    }
  };
};
