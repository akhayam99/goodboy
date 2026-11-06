import { turnReducer } from '@goodboy/core/turn';
import { findReusableAgent, runsForWorkflowRun } from '@goodboy/core/workflows';
import {
  insertMessage,
  insertProviderRun,
  updateProviderRunStatus,
  updateSessionState,
} from '@goodboy/db';
import type {
  Agent,
  AgentId,
  Message,
  MessageId,
  ProviderRun,
  ProviderRunId,
  TurnState,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { landingLiveKey } from '../../../features/chat/reveal/landingLiveKey';
import { liveTextRegistry } from '../../../features/chat/reveal/liveTextRegistry';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { applyAgentTurnState } from '../sessions/sessionMutators';
import { claimTurnStart, isTurnStartCancelled } from './turnStartWindow';
import { releaseUnstartedTurn } from './unstartedTurn/releaseUnstartedTurn';
import { hasOwnTurnRun } from './hasOwnTurnRun';
import { resolvePhaseAgent } from './resolvePhaseAgent';
import type { GetFn, SetFn, WithInput, TurnPhaseValue } from './types';
import { turnDone, turnReady } from './turnPhase';
import { NOT_BLOCKED } from './notBlocked';
import type { PreparedTurn } from './prepareTurn';
import type { RoutedTurn } from './routeTurn';
import type { LeasedTurn } from './leaseTurnWriter';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  ctx: WithInput & PreparedTurn & RoutedTurn & LeasedTurn;
}>;

export const startTurnRun = async ({ set, get, ctx }: Params) => {
  const { sessionId, sentVia, retry } = ctx.input;
  const {
    now,
    activeAgentId,
    activeAgent,
    userTurnText,
    deniedAsks,
    attachmentRefs,
    phaseDefinition,
    phaseWorkflowRunId,
    phaseTransitionEvent,
    turnMountId,
    provider,
    model,
    spawnModel,
    routingDecision,
    effortFlag,
    resolvedOverride,
  } = ctx;
  const runId = ctx.reservedRunId ?? ctx.input.runId ?? (crypto.randomUUID() as ProviderRunId);
  const runHistory = get().agentRunHistory[activeAgentId] ?? [];
  const isFirstTurn = runHistory.length === 0;
  const isHandoffTurn =
    retry == null &&
    activeAgent?.startedAt == null &&
    !hasOwnTurnRun({ history: runHistory, telemetry: get().sessionTelemetry[sessionId] ?? [] });

  set((state) => {
    const prev = state.agentRunHistory[activeAgentId] ?? [];
    if (prev.includes(runId)) {
      return state;
    }
    return {
      agentRunHistory: { ...state.agentRunHistory, [activeAgentId]: [...prev, runId] },
      runRouting: {
        ...state.runRouting,
        [activeAgentId]: {
          ...state.runRouting[activeAgentId],
          [runId]: { provider, model: spawnModel, effort: effortFlag ?? null },
        },
      },
    };
  });
  const providerRun: ProviderRun = {
    id: runId,
    sessionId,
    provider,
    model: spawnModel,
    status: { kind: 'streaming', startedAt: now() },
    routingDecision,
    createdAt: now(),
  };
  const closeCancelled = async () => {
    releaseUnstartedTurn({ set, get, sessionId, agentId: activeAgentId });
    await updateProviderRunStatus(tauriDatabase, runId, {
      kind: 'cancelled',
      finishedAt: now(),
    });
    return turnDone({ result: NOT_BLOCKED });
  };
  if (isTurnStartCancelled({ agentId: activeAgentId })) {
    claimTurnStart({ agentId: activeAgentId });
    await insertProviderRun(tauriDatabase, providerRun);
    return closeCancelled();
  }

  if (retry == null) {
    await ctx.input.onWritingUserText?.();
    const userMessage: Message = {
      id: crypto.randomUUID() as MessageId,
      sessionId,
      agentId: activeAgentId,
      role: 'user',
      content: userTurnText,
      createdAt: now(),
      ...(resolvedOverride !== undefined ? { providerOverride: resolvedOverride } : {}),
    };
    await insertMessage(tauriDatabase, userMessage);
    for (const ask of deniedAsks) {
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'permission_decision',
        runId: ask.runId,
        toolUseId: ask.toolUseId,
        decision: 'deny',
        scope: 'once',
        ruleId: null,
        decidedBy: 'user',
        reason: userTurnText.trim(),
        at: userMessage.createdAt,
      });
    }
    get().appendTurnEvent(activeAgentId, sessionId, {
      kind: 'user_text',
      runId,
      text: userTurnText,
      ...(attachmentRefs.length > 0 ? { attachments: attachmentRefs } : {}),
      provider,
      model,
      ...(isHandoffTurn && { handoffId: activeAgentId }),
      ...(sentVia !== undefined && { sentVia }),
      ...(ctx.input.deliveryId !== undefined && { deliveryId: ctx.input.deliveryId }),
      ...(ctx.input.origin === 'delegation' && { deliveredBy: 'auto' as const }),
      ...(ctx.input.outboxIds !== undefined &&
        ctx.input.outboxIds.length > 0 && { outboxIds: ctx.input.outboxIds }),
      at: userMessage.createdAt,
    });
  }
  await insertProviderRun(tauriDatabase, providerRun);
  if (claimTurnStart({ agentId: activeAgentId }) === 'cancelled') {
    return closeCancelled();
  }

  let resolvedAgentId: AgentId | null = null;
  let agentBefore: Agent | null =
    (get().sessionPhaseRuns[sessionId] ?? []).find((agent) => agent.id === activeAgentId) ?? null;
  if (phaseDefinition) {
    const runsForSession = get().sessionPhaseRuns[sessionId] ?? [];
    const scopedRuns = phaseWorkflowRunId
      ? runsForWorkflowRun(runsForSession, phaseWorkflowRunId)
      : runsForSession;
    const reusable = findReusableAgent(scopedRuns, phaseDefinition.id);
    agentBefore = reusable;
    let resolved: Agent | null = null;
    try {
      resolved =
        (await resolvePhaseAgent({
          sessionId,
          definition: phaseDefinition,
          workflowRunId: phaseWorkflowRunId,
          mountId: turnMountId,
          reusable,
          providerRunId: runId,
          now,
        })) ?? null;
    } catch (error) {
      console.error('resolvePhaseAgent failed', error);
    }
    if (resolved === null) {
      releaseUnstartedTurn({ set, get, sessionId, agentId: activeAgentId });
      await updateProviderRunStatus(tauriDatabase, runId, {
        kind: 'failed',
        finishedAt: now(),
        error: 'could not resolve the agent for this step',
      });
      return turnDone({ result: NOT_BLOCKED });
    }
    resolvedAgentId = resolved.id;
    const refreshedRuns = await invokeAgentList(sessionId);
    set((state) => ({
      sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
    }));
    if (phaseTransitionEvent && retry == null) {
      liveTextRegistry.mark({
        runId: landingLiveKey({ scope: 'transcript-event', id: phaseTransitionEvent.at }),
      });
      get().appendTurnEvent(activeAgentId, sessionId, { ...phaseTransitionEvent, runId });
    }
  }
  if (!phaseDefinition) {
    await invokeAgentUpdateStatus(activeAgentId, {
      status: 'running',
      providerRunId: runId,
      startedAt: now(),
    });
    resolvedAgentId = activeAgentId;
    const refreshedRuns = await invokeAgentList(sessionId);
    set((state) => ({
      sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
    }));
  }

  let nextAgentState: TurnState = get().agentTurnState[activeAgentId] ?? {
    kind: 'idle',
    lastActivityAt: now(),
  };
  if (nextAgentState.kind === 'draft') {
    nextAgentState = turnReducer(nextAgentState, { kind: 'start', at: now() });
  }
  if (nextAgentState.kind === 'error' || nextAgentState.kind === 'blocked') {
    nextAgentState = turnReducer(nextAgentState, { kind: 'retry', at: now() });
  }
  nextAgentState = turnReducer(nextAgentState, { kind: 'send', runId, at: now() });
  const derived = applyAgentTurnState(set, sessionId, activeAgentId, nextAgentState, now());
  await updateSessionState(tauriDatabase, sessionId, derived, now());
  return turnReady({ value: { runId, isFirstTurn, isHandoffTurn, resolvedAgentId, agentBefore } });
};

export type StartedTurn = TurnPhaseValue<typeof startTurnRun>;
