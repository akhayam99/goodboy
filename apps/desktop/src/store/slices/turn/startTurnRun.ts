import { turnReducer } from '@goodboy/core/turn';
import { findReusableAgent, runsForWorkflowRun } from '@goodboy/core/workflows';
import {
  insertMessage,
  insertProviderRun,
  revertAgentStart,
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
import { askDenialEventOf } from '../permissions/askDenialEventOf';
import { deniedPromptOf } from '../permissions/deniedPromptOf';
import { heldOnceAllowsOf } from '../permissions/heldOnceAllowsOf';
import { NO_RESOLVED_ASKS } from '../permissions/noResolvedAsks';
import { resolvedAsksAtWrite } from '../permissions/resolvedAsksAtWrite';
import { withHeldAnswers } from '../permissions/withHeldAnswers';
import { applyAgentTurnState, planAgentTurnState } from '../sessions/sessionMutators';
import { claimTurnStart, isTurnStartCancelled } from './turnStartWindow';
import { claimTurnAdmission } from './childTurn/claimTurnAdmission';
import { turnRefusalMessage } from './refusal/turnRefusalMessage';
import { CHECK_STATE } from '../notifications/errorRecovery';
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

  let resolvedAsks = ctx.input.resolvedAsks ?? NO_RESOLVED_ASKS;
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
    const atWrite = get();
    const turnAtWrite = atWrite.agentTurnState[activeAgentId];
    resolvedAsks = resolvedAsksAtWrite({
      events: atWrite.transcripts[activeAgentId] ?? [],
      turnState: turnAtWrite?.kind === 'starting' ? ctx.turnBeforeLease : turnAtWrite,
      origin: ctx.input.origin,
      given: ctx.input.resolvedAsks,
    });
    for (const ask of resolvedAsks.denied) {
      get().appendTurnEvent(
        activeAgentId,
        sessionId,
        askDenialEventOf({
          runId: ask.runId,
          toolUseId: ask.toolUseId,
          reason: userTurnText,
          at: userMessage.createdAt,
        }),
      );
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
  const claimedFrom = agentBefore;
  const releaseClaim = (): Promise<void> =>
    revertAgentStart({
      db: tauriDatabase,
      agentId: activeAgentId,
      runId,
      agentBefore: claimedFrom,
    }).catch((revertError: unknown) =>
      get().reportError({
        recovery: CHECK_STATE,
        title: "Couldn't free the agent after its turn failed to start",
        error: revertError,
        sessionId,
      }),
    );
  let isClaimed = false;
  try {
    if (!phaseDefinition) {
      const isAdmitted = await claimTurnAdmission({
        agentId: activeAgentId,
        delegationId: ctx.childTurn?.delegationId ?? null,
        runId,
      });
      if (!isAdmitted) {
        const message = turnRefusalMessage({ refusal: 'auto_child_changed' });
        releaseUnstartedTurn({ set, get, sessionId, agentId: activeAgentId });
        await updateProviderRunStatus(tauriDatabase, runId, {
          kind: 'failed',
          finishedAt: now(),
          error: message,
        });
        get().appendTurnEvent(activeAgentId, sessionId, {
          kind: 'error',
          runId,
          message,
          at: now(),
        });
        return turnDone({
          result: { blockedOverBudget: false, autoChildRefusal: 'auto_child_changed' },
        });
      }
      isClaimed = true;
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
    const at = now();
    const planned = planAgentTurnState({
      store: get(),
      sessionId,
      agentId: activeAgentId,
      agentState: nextAgentState,
      now: at,
    });
    await updateSessionState(tauriDatabase, sessionId, planned.derived, at);
    applyAgentTurnState(set, sessionId, activeAgentId, nextAgentState, at);
  } catch (error) {
    if (isClaimed) {
      await releaseClaim();
    }
    throw error;
  }
  return turnReady({
    value: {
      runId,
      hasAdmission: isClaimed,
      isFirstTurn,
      isHandoffTurn,
      resolvedAgentId,
      agentBefore,
      resolvedAsks,
      resolvedPrompt: withHeldAnswers({
        held: resolvedAsks.held,
        prompt: deniedPromptOf({
          asks: resolvedAsks.denied,
          content: userTurnText,
          prompt: ctx.resolvedPrompt,
        }),
      }),
      input: {
        ...ctx.input,
        permissionOnceAllows: [
          ...new Set([
            ...(ctx.input.permissionOnceAllows ?? []),
            ...heldOnceAllowsOf({ held: resolvedAsks.held }),
          ]),
        ],
      },
    },
  });
};

export type StartedTurn = TurnPhaseValue<typeof startTurnRun>;
