import { formatError } from '@goodboy/ui';
import type { AgentId, IsoDateTime, PlanId, SessionId } from '@goodboy/types';
import { recordArtifactProvenance } from '../../../features/artifacts/artifactProvenance';
import { prepareArtifactEvidence } from '../../../features/artifacts/prepareArtifactEvidence';
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
  composePlanSection,
  composeStepBoundary,
} from '../../kickoff';
import type { SpawnFocus } from '../session-view/spawnFocus';
import {
  canFanOutClusters,
  fanOutClusters,
  resumeClusterChildren,
  selectFanOutPlan,
  unsettledClusterChildren,
} from './clusterImplementation';
import { isWatchingWorkflowLens } from './isWatchingWorkflowLens';
import { WorkflowGateError, findWorkflowActivationBlock } from './workflowActivationGate';
import type { GetFn, SetFn } from './types';

export type ActivateWorkflowAgentParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly explicitPlanId?: PlanId;
  readonly focus?: SpawnFocus;
  readonly bypassGate?: boolean;
};

export const activateWorkflowAgent = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    agentId,
    explicitPlanId,
    focus = 'none',
    bypassGate = false,
  }: ActivateWorkflowAgentParams) => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const agent = runs.find((r) => r.id === agentId);
    if (!agent || !agent.stepId) {
      throw new Error('agent not found or not a workflow agent');
    }

    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || session.workflowRuns.length === 0) {
      throw new Error('session has no workflow');
    }

    if (bypassGate !== true) {
      const blocked = await findWorkflowActivationBlock({
        sessionId,
        workflowRunId: agent.workflowRunId,
      });
      if (blocked !== null) {
        throw new WorkflowGateError({ reason: blocked });
      }
    }

    if (unsettledClusterChildren(runs, agentId).length > 0) {
      await resumeClusterChildren({ set, get, sessionId, container: agent });
      return;
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
      ...(focus === 'agent' && !isWatchingWorkflowLens({ state: s, sessionId })
        ? { selectedAgentId: { ...s.selectedAgentId, [sessionId]: agentId } }
        : {}),
    }));

    if (focus === 'announce') {
      window.dispatchEvent(
        new CustomEvent('goodboy:workflow-step-started', {
          detail: { sessionId, agentId, stepName: step?.name ?? agent.name },
        }),
      );
    }

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
        ? composePlanSection({ bodyMd: explicitPlan.bodyMd })
        : latestSection
      : '';
    const planToConsume = explicitPlan ?? (latestPlan?.status === 'active' ? latestPlan : null);

    const fanOutPlan =
      effectiveKind === 'implementer' && canFanOutClusters({ container: agent })
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

    const evidence =
      effectiveKind === 'report' || effectiveKind === 'wireframe'
        ? await prepareArtifactEvidence({
            state: get(),
            session,
            workflowRunId: agent.workflowRunId ?? null,
            brief: promptPrefix,
            executingAgentId: agentId,
            ...(effectiveKind === 'report'
              ? { kind: 'report', reportType: 'session-summary' }
              : { kind: 'wireframe', fidelity: 'low' }),
          })
        : null;
    if (evidence !== null) {
      await recordArtifactProvenance({
        ...evidence.provenance,
        agentId,
        executingWorkflowRunId: agent.workflowRunId ?? null,
      }).catch((error: unknown) => {
        console.warn(`[artifact-provenance] ${effectiveKind} ${agentId}: ${formatError(error)}`);
      });
    }

    const kickoff = composeKickoff(
      goalSection,
      planSection,
      evidence?.text ?? promptPrefix,
      composeStepBoundary(agentId),
    );
    if (kickoff.length > 0) {
      await get().sendTurn({ sessionId, agentId, content: kickoff, origin: 'workflow' });
    }
  };
};
