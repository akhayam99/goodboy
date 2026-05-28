import type {
  AgentId,
  IsoDateTime,
  PlanId,
  PlanWithCount,
  SessionId,
  Step,
  StepId,
} from '@goodboy/types';
import { invokeAgentInsert, invokeAgentList } from '../../../features/workflows/workflows';
import {
  addPlanConsumption as invokeAddPlanConsumption,
  listConsumptionsForPlan as invokeListConsumptionsForPlan,
  listPlansForSession as invokeListPlansForSession,
} from '../../../features/plans/plans';
import { inferAgentKindFromName, type AgentKind } from '../../../features/session/agent-kind';
import { buildPlanKickoffSection, composeKickoff } from '../../kickoff';
import type { GetFn, SetFn } from './types';

interface SpawnArgs {
  stepId?: StepId;
  name?: string;
  model?: string;
  effort?: string;
  initialPrompt?: string;
  triggeredPlanId?: PlanId;
  kindOverride?: AgentKind;
}

export function spawnAgent(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, args: SpawnArgs): Promise<AgentId> => {
    const state = get();
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    let resolvedName = args.name;
    let stepPromptPrefix = '';
    if (args.stepId) {
      const templates = state.phaseTemplates[session.workspaceId] ?? [];
      const attached = templates.filter((t) => session.workflowIds.includes(t.id));
      let step: Step | null = null;
      for (const t of attached) {
        const found = t.steps.find((s) => s.id === args.stepId);
        if (found) {
          step = found;
          break;
        }
      }
      if (step) {
        if (!resolvedName) resolvedName = step.name;
        stepPromptPrefix = step.promptPrefix;
      }
    }
    if (!resolvedName) {
      const existing = state.sessionPhaseRuns[sessionId] ?? [];
      resolvedName = `agent ${existing.length + 1}`;
    }
    const currentRuns = state.sessionPhaseRuns[sessionId] ?? [];
    const nextOrdinal = currentRuns.reduce((max, r) => Math.max(max, r.ordinal), -1) + 1;
    const workspaceVerbositySeed =
      state.workspaceOverrides[session.workspaceId]?.defaultVerbosity ?? undefined;
    const inserted = await invokeAgentInsert({
      sessionId,
      ...(args.stepId !== undefined && { stepId: args.stepId }),
      ordinal: nextOrdinal,
      name: resolvedName,
      status: 'pending',
      ...(args.kindOverride !== undefined && { kind: args.kindOverride }),
      ...(workspaceVerbositySeed && { verbosity: workspaceVerbositySeed }),
    });
    const refreshed = await invokeAgentList(sessionId);
    set((s) => ({
      sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
      selectedAgentId: { ...s.selectedAgentId, [sessionId]: inserted.id },
      transcripts: { ...s.transcripts, [inserted.id]: [] },
      messages: { ...s.messages, [sessionId]: [] },
      agentTurnState: {
        ...s.agentTurnState,
        [inserted.id]: { kind: 'idle', lastActivityAt: new Date().toISOString() as IsoDateTime },
      },
      ...(args.model !== undefined && {
        agentModelOverride: { ...s.agentModelOverride, [inserted.id]: args.model },
      }),
      ...(args.kindOverride !== undefined && {
        agentKindOverride: { ...s.agentKindOverride, [inserted.id]: args.kindOverride },
      }),
    }));
    const baseKickoff = stepPromptPrefix.length > 0 ? stepPromptPrefix : (args.initialPrompt ?? '');
    const effectiveKind: AgentKind =
      args.kindOverride ??
      (inserted.kind as AgentKind | undefined) ??
      inferAgentKindFromName(resolvedName);
    const isImplementer = effectiveKind === 'implementer';
    let planSection = '';
    let planToConsume: PlanWithCount | null = null;
    if (isImplementer) {
      const { section: latestSection, plan: latestPlan } = await buildPlanKickoffSection(sessionId);
      const explicitPlan =
        args.triggeredPlanId !== undefined
          ? (get().sessionPlans[sessionId]?.find((p) => p.id === args.triggeredPlanId) ?? null)
          : null;
      planSection = explicitPlan
        ? ['Active plan to execute:', '', explicitPlan.bodyMd].join('\n')
        : latestSection;
      const workflowAutoConsume = args.stepId !== undefined && latestPlan?.status === 'active';
      planToConsume = explicitPlan ?? (workflowAutoConsume ? latestPlan : null);
    }
    const kickoff = composeKickoff(planSection, baseKickoff);
    if (kickoff.length > 0) {
      void get().sendTurn({ sessionId, agentId: inserted.id, content: kickoff });
    }

    if (planToConsume) {
      await invokeAddPlanConsumption(planToConsume.id, inserted.id);
      const refreshedPlans = await invokeListPlansForSession(sessionId);
      const consumptions = await invokeListConsumptionsForPlan(planToConsume.id);
      set((s) => ({
        sessionPlans: { ...s.sessionPlans, [sessionId]: refreshedPlans },
        planConsumptions: { ...s.planConsumptions, [planToConsume.id]: consumptions },
      }));
    }

    return inserted.id;
  };
}
