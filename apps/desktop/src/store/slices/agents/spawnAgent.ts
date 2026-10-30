import type { ResolveAttemptBatch, ResolveAttemptLaunch } from '../resolve/types';
import {
  brandId,
  type AgentId,
  type AgentSourceKind,
  type IsoDateTime,
  type MountId,
  type PlanId,
  type PlanWithCount,
  type ProviderId,
  type Session,
  type SessionId,
  type Step,
  type StepId,
  type WorkflowRunId,
} from '@goodboy/types';
import { isAutoOwnProvider } from '@goodboy/core';
import { updateAgentConfig } from '@goodboy/db';
import { invokeAgentInsert, invokeAgentList } from '../../../features/workflows/workflows';
import { tauriDatabase } from '../../../shared/lib/db';
import { EFFORT_LEVELS } from '../../../features/chat/utils/chat-constants';
import { rulesOfKickoff } from '../../../features/chat/utils/resolverKickoffParts';
import {
  addPlanConsumption as invokeAddPlanConsumption,
  listConsumptionsForPlan as invokeListConsumptionsForPlan,
  listPlansForSession as invokeListPlansForSession,
} from '../../../features/plans/plans';
import {
  kindConsumesPlan,
  resolveAgentKind,
  storedAgentKind,
  type AgentKind,
} from '../../../features/session/agent-kind';
import { buildPlanKickoffSection, composeKickoff, composePlanSection } from '../turn/kickoff';
import { runGuidanceSection } from '../workflows/standingGuidance';
import { writeRunGuidance } from '../../runtime/runGuidance/writeRunGuidance';
import { namedMountTarget } from '../resolve/mountTarget';
import {
  canFanOutClusters,
  fanOutClusters,
  selectFanOutPlan,
} from '../workflows/clusterImplementation';
import { workSurfaceFocus } from '../session-view/workSurfaceFocus';
import type { SpawnFocus } from '../session-view/spawnFocus';
import { createKeyedQueue } from '../../../shared/utils/keyedQueue';
import type { GetFn, SetFn } from './types';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import { ReportedError, isReportedError } from '../notifications/reportedError';
import { sessionById } from '../sessions/sessionIndex';
import { scopedKindRouting } from './scopedKindRouting';
import { sendAutoKickoff } from './sendAutoKickoff';
import { currentAutoUserTurnPort } from '../../../features/auto/autoUserTurnPort';
import { createStaleMountError } from '../resolve/rebuildFailure/createStaleMountError';
import { sessionReads } from '../../runtime/state-writes/sessionReads';
import { OPEN_PROVIDER_SETTINGS } from '../notifications/errorRecovery';

const spawnQueue = createKeyedQueue();

type SpawnArgs = {
  stepId?: StepId;
  mountId?: MountId;
  expectedMountRevision?: number;
  workflowRunId?: WorkflowRunId;
  name?: string;
  model?: string;
  provider?: ProviderId;
  effort?: string;
  initialPrompt?: string;
  guidance?: string | null;
  humanPrompt?: string;
  seedPrompt?: string;
  triggeredPlanId?: PlanId;
  kindOverride?: AgentKind;
  sourceThreadId?: string;
  sourceThreadIds?: ReadonlyArray<string>;
  sourceCommentUrl?: string;
  sourceKind?: AgentSourceKind;
  focus?: SpawnFocus;
  shouldDeferKickoff?: boolean;
  parentAgentId?: AgentId;
  resolveBatch?: ResolveAttemptBatch;
  resolveLaunch?: ResolveAttemptLaunch;
  onKickoffAccepted?: () => void;
};

const NO_ALLOWED_MODEL_TITLE = 'No model is allowed for this agent';
const NO_ALLOWED_MODEL_MESSAGE =
  'Every model this agent could use is hidden. Show a model in Settings, or pick one for this agent by hand.';

const AUTO_PROVIDER_TITLE = "Auto can't run on this provider";
const AUTO_PROVIDER_MESSAGE =
  'Auto only reads, and this provider cannot confine a read-only agent yet. Pick Claude, Codex, Cursor or Gemini for Auto.';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly session: Session;
  readonly args: SpawnArgs;
};

const runSpawn = async ({ set, get, sessionId, session, args }: Params): Promise<AgentId> => {
  const state = get();
  if (
    args.kindOverride === 'resolver' &&
    args.mountId !== undefined &&
    namedMountTarget({ get, sessionId, mountId: args.mountId }) === null
  ) {
    throw new Error('This repository is no longer part of the session');
  }
  let resolvedName = args.name;
  let stepPromptPrefix = '';
  if (args.stepId) {
    const templates = state.phaseTemplates[session.workspaceId] ?? [];
    let step: Step | null = null;
    const run = args.workflowRunId
      ? session.workflowRuns.find((r) => r.id === args.workflowRunId)
      : undefined;
    if (run) {
      const template = templates.find((t) => t.id === run.workflowId);
      step = template?.steps.find((s) => s.id === args.stepId) ?? null;
    } else {
      const attachedIds = new Set(session.workflowRuns.map((r) => r.workflowId));
      for (const t of templates) {
        if (!attachedIds.has(t.id)) {
          continue;
        }
        const found = t.steps.find((s) => s.id === args.stepId);
        if (found) {
          step = found;
          break;
        }
      }
    }
    if (step) {
      if (!resolvedName) {
        resolvedName = step.name;
      }
      stepPromptPrefix = step.promptPrefix;
    }
  }
  const guidance = args.guidance?.trim() ?? '';
  const { inserted, resolvedKind, resolvedProvider, resolvedModel, resolvedEffort } =
    await spawnQueue.run({
      key: sessionId,
      task: async () => {
        if (
          args.expectedMountRevision !== undefined &&
          namedMountTarget({ get, sessionId, mountId: args.mountId })?.mountRevision !==
            args.expectedMountRevision
        ) {
          throw createStaleMountError();
        }
        const currentRuns = get().sessionPhaseRuns[sessionId] ?? [];
        const nextOrdinal = currentRuns.reduce((max, r) => Math.max(max, r.ordinal), -1) + 1;
        const agentName =
          resolvedName !== undefined && resolvedName !== ''
            ? resolvedName
            : `agent ${nextOrdinal + 1}`;
        const settings = selectResolvedSettings({ state, sessionId });
        const workspaceVerbositySeed = settings?.defaultVerbosityOverride ?? undefined;
        const resolvedKind = resolveAgentKind({
          name: agentName,
          firstUserText: null,
          override: args.kindOverride ?? null,
        });
        const roleModels = settings?.roleModels ?? null;
        const routing = scopedKindRouting({ state: get(), settings, kind: resolvedKind });
        if (routing.noAllowedModel === true && args.provider == null && args.model == null) {
          const error = new ReportedError(NO_ALLOWED_MODEL_MESSAGE);
          await get().reportError({
            title: NO_ALLOWED_MODEL_TITLE,
            error,
            sessionId,
            recovery: OPEN_PROVIDER_SETTINGS,
          });
          throw error;
        }
        if (
          resolvedKind === 'auto' &&
          !isAutoOwnProvider({ provider: args.provider ?? routing.provider })
        ) {
          const error = new ReportedError(AUTO_PROVIDER_MESSAGE);
          await get().reportError({ title: AUTO_PROVIDER_TITLE, error, sessionId });
          throw error;
        }
        const sourceThreadId = args.sourceThreadIds?.[0] ?? args.sourceThreadId;
        const newAgentId = brandId<AgentId>({ value: crypto.randomUUID() });
        if (guidance !== '') {
          await writeRunGuidance({
            db: tauriDatabase,
            workspaceId: session.workspaceId,
            agentId: newAgentId,
            text: guidance,
          });
        }
        const inserted = await invokeAgentInsert({
          id: newAgentId,
          sessionId,
          ...(args.stepId !== undefined && { stepId: args.stepId }),
          ...(args.workflowRunId !== undefined && { workflowRunId: args.workflowRunId }),
          ordinal: nextOrdinal,
          name: agentName,
          status: 'pending',
          kind: resolvedKind,
          ...(workspaceVerbositySeed && { verbosity: workspaceVerbositySeed }),
          ...(sourceThreadId !== undefined && { sourceThreadId }),
          ...(args.sourceThreadIds !== undefined && { sourceThreadIds: args.sourceThreadIds }),
          ...(args.sourceCommentUrl !== undefined && { sourceCommentUrl: args.sourceCommentUrl }),
          ...(args.sourceKind !== undefined && { sourceKind: args.sourceKind }),
          ...(args.mountId !== undefined && { mountId: args.mountId }),
          ...(args.parentAgentId !== undefined && { parentAgentId: args.parentAgentId }),
        });
        const resolvedProvider = args.provider ?? routing.provider;
        const resolvedModel = args.model ?? routing.model;
        const resolvedEffort =
          EFFORT_LEVELS.find((level) => level === args.effort) ?? routing.effort;
        await updateAgentConfig(tauriDatabase, inserted.id, {
          providerOverride: resolvedProvider,
          modelOverride: resolvedModel,
          effort: resolvedEffort,
        });
        const listed = await invokeAgentList(sessionId);
        const refreshed = listed.map((agent) =>
          agent.id === inserted.id
            ? {
                ...agent,
                providerOverride: resolvedProvider,
                modelOverride: resolvedModel,
                effort: resolvedEffort,
              }
            : agent,
        );
        const takesFocus = args.focus === 'agent';
        set((s) => ({
          sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
          ...(takesFocus &&
            workSurfaceFocus({
              sessionId,
              focus: { kind: 'agent', agentId: inserted.id },
              activeLens: s.activeLens,
              selectedAgentId: s.selectedAgentId,
            })),
          transcripts: { ...s.transcripts, [inserted.id]: [] },
          messages: { ...s.messages, [sessionId]: [] },
          agentTurnState: {
            ...s.agentTurnState,
            [inserted.id]: {
              kind: 'idle',
              lastActivityAt: new Date().toISOString() as IsoDateTime,
            },
          },
          agentModelOverride: {
            ...s.agentModelOverride,
            [inserted.id]: resolvedModel,
          },
          agentProviderOverride: {
            ...s.agentProviderOverride,
            [inserted.id]: resolvedProvider,
          },
          agentEffortOverride: {
            ...s.agentEffortOverride,
            [inserted.id]: resolvedEffort,
          },
          ...(args.kindOverride !== undefined && {
            agentKindOverride: { ...s.agentKindOverride, [inserted.id]: args.kindOverride },
          }),
        }));
        return { inserted, resolvedKind, resolvedProvider, resolvedModel, resolvedEffort };
      },
    });
  const explicitPrompt =
    stepPromptPrefix.length > 0 ? stepPromptPrefix : (args.initialPrompt ?? '');
  const baseKickoff = explicitPrompt.length > 0 ? explicitPrompt : (args.seedPrompt ?? '');
  const effectiveKind: AgentKind =
    args.kindOverride ??
    (inserted.kind === undefined ? resolvedKind : storedAgentKind({ kind: inserted.kind }));
  const isImplementer = effectiveKind === 'implementer';
  const hasExplicitPlanContext = args.triggeredPlanId !== undefined || args.stepId !== undefined;
  const engagePlan =
    isImplementer || (kindConsumesPlan({ kind: effectiveKind }) && hasExplicitPlanContext);
  let planSection = '';
  let planToConsume: PlanWithCount | null = null;
  let planForKickoff: PlanWithCount | null = null;
  let explicitPlan: PlanWithCount | null = null;
  if (engagePlan) {
    const { section: latestSection, plan: latestPlan } = await buildPlanKickoffSection(
      sessionId,
      args.workflowRunId,
    );
    explicitPlan =
      args.triggeredPlanId !== undefined
        ? (get().sessionPlans[sessionId]?.find((p) => p.id === args.triggeredPlanId) ?? null)
        : null;
    planSection = explicitPlan
      ? composePlanSection({ bodyMd: explicitPlan.bodyMd })
      : latestSection;
    planForKickoff = explicitPlan ?? latestPlan;
    const workflowAutoConsume = args.stepId !== undefined && latestPlan?.status === 'active';
    planToConsume = explicitPlan ?? (workflowAutoConsume ? latestPlan : null);
  }

  const fanOutPlan =
    isImplementer && canFanOutClusters({ container: inserted })
      ? selectFanOutPlan(get, sessionId, { workflowRunId: args.workflowRunId, explicitPlan })
      : null;
  const clusters =
    fanOutPlan?.clusters &&
    fanOutPlan.clusters.length >= 2 &&
    (args.initialPrompt ?? '').length === 0
      ? fanOutPlan.clusters
      : undefined;
  if (clusters && clusters.length >= 2) {
    const consumeTarget = planToConsume ?? fanOutPlan;
    if (consumeTarget) {
      await invokeAddPlanConsumption(consumeTarget.id, inserted.id);
      const plansRead = sessionReads.plans({ sessionId });
      const refreshedPlans = await invokeListPlansForSession(sessionId);
      const consumptions = await invokeListConsumptionsForPlan(consumeTarget.id);
      set((s) => ({
        ...(plansRead.isCurrent() && {
          sessionPlans: { ...s.sessionPlans, [sessionId]: refreshedPlans },
        }),
        planConsumptions: { ...s.planConsumptions, [consumeTarget.id]: consumptions },
      }));
    }
    await fanOutClusters(set, get, sessionId, inserted, clusters, fanOutPlan!.title);
    return inserted.id;
  }

  const kickoff = composeKickoff(
    effectiveKind === 'auto' ? '' : runGuidanceSection({ text: guidance }),
    planSection,
    baseKickoff,
  );
  const humanPrompt =
    args.humanPrompt !== undefined && kickoff === args.initialPrompt ? args.humanPrompt : null;
  const machineRules =
    humanPrompt === null ? null : rulesOfKickoff({ message: kickoff, human: humanPrompt });
  const isRecheck = args.sourceKind === 'comment_recheck';
  const autoKickoffPort =
    effectiveKind === 'auto' && kickoff.length > 0 && args.shouldDeferKickoff !== true
      ? currentAutoUserTurnPort()
      : null;
  if (autoKickoffPort !== null) {
    sendAutoKickoff({
      get,
      port: autoKickoffPort,
      sessionId,
      workspaceId: session.workspaceId,
      agentId: inserted.id,
      text: kickoff,
      onKickoffAccepted: args.onKickoffAccepted,
    });
    return inserted.id;
  }
  if (resolvedKind === 'resolver') {
    await get().recordResolveAttempt({
      sessionId,
      agent: inserted,
      provider: resolvedProvider,
      model: resolvedModel,
      effort: resolvedEffort,
      instructions: kickoff,
      humanInstructions: machineRules === null ? null : humanPrompt,
      phase: 'queued',
      mountTarget: namedMountTarget({ get, sessionId, mountId: args.mountId }),
      ...(args.resolveBatch !== undefined && { batch: args.resolveBatch }),
      ...(args.resolveLaunch !== undefined && { launch: args.resolveLaunch }),
    });
    if (kickoff.length > 0) {
      void get().drainResolveQueue({ sessionId });
    }
  } else if (kickoff.length > 0 && args.shouldDeferKickoff !== true) {
    const handedPlan = planSection === '' ? null : planForKickoff;
    void get()
      .sendTurn({
        sessionId,
        agentId: inserted.id,
        content: kickoff,
        ...(args.mountId !== undefined && { mountId: args.mountId }),
        ...(args.onKickoffAccepted !== undefined && { onStarted: args.onKickoffAccepted }),
        handoff:
          isRecheck && humanPrompt !== null && machineRules !== null
            ? {
                sender: {
                  kind: 'recheck',
                  threadIds: args.sourceThreadIds ?? [],
                  prNumber: null,
                },
                instruction: humanPrompt,
                machineInstructions: machineRules,
                plan: null,
              }
            : {
                instruction: baseKickoff,
                plan: handedPlan === null ? null : { id: handedPlan.id, title: handedPlan.title },
              },
      })
      .then((result) => {
        if (result?.isLaneQueued === true) {
          args.onKickoffAccepted?.();
        }
      })
      .catch((error: unknown) => {
        if (isReportedError(error)) {
          return;
        }
        void get().reportError({ title: "The agent didn't start", error, sessionId });
      });
  }

  if (planToConsume) {
    await invokeAddPlanConsumption(planToConsume.id, inserted.id);
    const plansRead = sessionReads.plans({ sessionId });
    const refreshedPlans = await invokeListPlansForSession(sessionId);
    const consumptions = await invokeListConsumptionsForPlan(planToConsume.id);
    set((s) => ({
      ...(plansRead.isCurrent() && {
        sessionPlans: { ...s.sessionPlans, [sessionId]: refreshedPlans },
      }),
      planConsumptions: { ...s.planConsumptions, [planToConsume.id]: consumptions },
    }));
  }

  return inserted.id;
};

export const spawnAgent = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, args: SpawnArgs): Promise<AgentId> => {
    const session = sessionById(get().sessions, sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }
    const creationId = get().beginSessionCreation(sessionId, {
      kind: 'agent',
      label: args.name ?? null,
    });
    try {
      return await runSpawn({ set, get, sessionId, session, args });
    } finally {
      get().endSessionCreation(sessionId, creationId);
    }
  };
};
