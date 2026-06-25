import type {
  AgentId,
  IsoDateTime,
  PlanId,
  PlanWithCount,
  ProviderId,
  SessionId,
  Step,
  StepId,
  WorkflowRunId,
} from '@goodboy/types'
import { invokeAgentInsert, invokeAgentList } from '../../../features/workflows/workflows'
import {
  addPlanConsumption as invokeAddPlanConsumption,
  listConsumptionsForPlan as invokeListConsumptionsForPlan,
  listPlansForSession as invokeListPlansForSession,
} from '../../../features/plans/plans'
import {
  inferAgentKindFromName,
  kindConsumesPlan,
  type AgentKind,
} from '../../../features/session/agent-kind'
import { buildPlanKickoffSection, composeKickoff } from '../../kickoff'
import { fanOutClusters, selectFanOutPlan } from '../workflows/clusterImplementation'
import type { GetFn, SetFn } from './types'

type SpawnArgs = {
  stepId?: StepId
  workflowRunId?: WorkflowRunId
  name?: string
  model?: string
  provider?: ProviderId
  effort?: string
  initialPrompt?: string
  triggeredPlanId?: PlanId
  kindOverride?: AgentKind
  sourceThreadId?: string
  sourceCommentUrl?: string
  deferKickoff?: boolean
}

export const spawnAgent = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, args: SpawnArgs): Promise<AgentId> => {
    const state = get()
    const session = state.sessions.find((s) => s.id === sessionId)
    if (!session) {
      throw new Error(`session not found: ${sessionId}`)
    }
    let resolvedName = args.name
    let stepPromptPrefix = ''
    if (args.stepId) {
      const templates = state.phaseTemplates[session.workspaceId] ?? []
      let step: Step | null = null
      const run = args.workflowRunId
        ? session.workflowRuns.find((r) => r.id === args.workflowRunId)
        : undefined
      if (run) {
        const template = templates.find((t) => t.id === run.workflowId)
        step = template?.steps.find((s) => s.id === args.stepId) ?? null
      } else {
        const attachedIds = new Set(session.workflowRuns.map((r) => r.workflowId))
        for (const t of templates) {
          if (!attachedIds.has(t.id)) {
            continue
          }
          const found = t.steps.find((s) => s.id === args.stepId)
          if (found) {
            step = found
            break
          }
        }
      }
      if (step) {
        if (!resolvedName) {
          resolvedName = step.name
        }
        stepPromptPrefix = step.promptPrefix
      }
    }
    if (!resolvedName) {
      const existing = state.sessionPhaseRuns[sessionId] ?? []
      resolvedName = `agent ${existing.length + 1}`
    }
    const currentRuns = state.sessionPhaseRuns[sessionId] ?? []
    const nextOrdinal = currentRuns.reduce((max, r) => Math.max(max, r.ordinal), -1) + 1
    const workspaceVerbositySeed =
      state.workspaceOverrides[session.workspaceId]?.defaultVerbosity ?? undefined
    const inserted = await invokeAgentInsert({
      sessionId,
      ...(args.stepId !== undefined && { stepId: args.stepId }),
      ...(args.workflowRunId !== undefined && { workflowRunId: args.workflowRunId }),
      ordinal: nextOrdinal,
      name: resolvedName,
      status: 'pending',
      ...(args.kindOverride !== undefined && { kind: args.kindOverride }),
      ...(workspaceVerbositySeed && { verbosity: workspaceVerbositySeed }),
      ...(args.sourceThreadId !== undefined && { sourceThreadId: args.sourceThreadId }),
      ...(args.sourceCommentUrl !== undefined && { sourceCommentUrl: args.sourceCommentUrl }),
    })
    const refreshed = await invokeAgentList(sessionId)
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
      ...(args.provider !== undefined && {
        agentProviderOverride: { ...s.agentProviderOverride, [inserted.id]: args.provider },
      }),
      ...(args.effort !== undefined && {
        agentEffortOverride: { ...s.agentEffortOverride, [inserted.id]: args.effort },
      }),
      ...(args.kindOverride !== undefined && {
        agentKindOverride: { ...s.agentKindOverride, [inserted.id]: args.kindOverride },
      }),
    }))
    const baseKickoff = stepPromptPrefix.length > 0 ? stepPromptPrefix : (args.initialPrompt ?? '')
    const effectiveKind: AgentKind =
      args.kindOverride ??
      (inserted.kind as AgentKind | undefined) ??
      inferAgentKindFromName(resolvedName)
    const isImplementer = effectiveKind === 'implementer'
    const hasExplicitPlanContext = args.triggeredPlanId !== undefined || args.stepId !== undefined
    const engagePlan = isImplementer || (kindConsumesPlan(effectiveKind) && hasExplicitPlanContext)
    let planSection = ''
    let planToConsume: PlanWithCount | null = null
    let planForKickoff: PlanWithCount | null = null
    let explicitPlan: PlanWithCount | null = null
    if (engagePlan) {
      const { section: latestSection, plan: latestPlan } = await buildPlanKickoffSection(
        sessionId,
        args.workflowRunId,
      )
      explicitPlan =
        args.triggeredPlanId !== undefined
          ? (get().sessionPlans[sessionId]?.find((p) => p.id === args.triggeredPlanId) ?? null)
          : null
      planSection = explicitPlan
        ? ['Active plan to execute:', '', explicitPlan.bodyMd].join('\n')
        : latestSection
      planForKickoff = explicitPlan ?? latestPlan
      const workflowAutoConsume = args.stepId !== undefined && latestPlan?.status === 'active'
      planToConsume = explicitPlan ?? (workflowAutoConsume ? latestPlan : null)
    }

    const fanOutPlan =
      isImplementer && !args.deferKickoff
        ? selectFanOutPlan(get, sessionId, { workflowRunId: args.workflowRunId, explicitPlan })
        : null
    const clusters =
      fanOutPlan?.clusters &&
      fanOutPlan.clusters.length >= 2 &&
      (args.initialPrompt ?? '').length === 0
        ? fanOutPlan.clusters
        : undefined
    if (clusters && clusters.length >= 2) {
      const consumeTarget = planToConsume ?? fanOutPlan
      if (consumeTarget) {
        await invokeAddPlanConsumption(consumeTarget.id, inserted.id)
        const refreshedPlans = await invokeListPlansForSession(sessionId)
        const consumptions = await invokeListConsumptionsForPlan(consumeTarget.id)
        set((s) => ({
          sessionPlans: { ...s.sessionPlans, [sessionId]: refreshedPlans },
          planConsumptions: { ...s.planConsumptions, [consumeTarget.id]: consumptions },
        }))
      }
      await fanOutClusters(set, get, sessionId, inserted, clusters, fanOutPlan!.title)
      return inserted.id
    }

    const kickoff = composeKickoff(planSection, baseKickoff)
    if (kickoff.length > 0) {
      if (args.deferKickoff) {
        set((s) => ({
          pendingResolverKickoff: { ...s.pendingResolverKickoff, [inserted.id]: kickoff },
        }))
      } else {
        void get().sendTurn({ sessionId, agentId: inserted.id, content: kickoff })
      }
    }

    if (planToConsume) {
      await invokeAddPlanConsumption(planToConsume.id, inserted.id)
      const refreshedPlans = await invokeListPlansForSession(sessionId)
      const consumptions = await invokeListConsumptionsForPlan(planToConsume.id)
      set((s) => ({
        sessionPlans: { ...s.sessionPlans, [sessionId]: refreshedPlans },
        planConsumptions: { ...s.planConsumptions, [planToConsume.id]: consumptions },
      }))
    }

    return inserted.id
  }
}
