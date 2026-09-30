import { findReusableAgent, runsForWorkflowRun, turnReducer } from '@goodboy/core';
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
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { applyAgentTurnState } from '../sessions/sessionMutators';
import { claimTurnStart } from './turnStartWindow';
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
    provider,
    model,
    spawnModel,
    routingDecision,
    effortFlag,
    resolvedOverride,
  } = ctx;
  const runId = crypto.randomUUID() as ProviderRunId;
  const isFirstTurn = (get().agentRunHistory[activeAgentId] ?? []).length === 0;
  const isHandoffTurn = retry == null && isFirstTurn && activeAgent?.startedAt == null;

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
  if (retry == null) {
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
    get().appendTurnEvent(activeAgentId, sessionId, {
      kind: 'user_text',
      runId,
      text: userTurnText,
      ...(attachmentRefs.length > 0 ? { attachments: attachmentRefs } : {}),
      provider,
      model,
      ...(isHandoffTurn && { handoffId: activeAgentId }),
      ...(sentVia !== undefined && { sentVia }),
      at: userMessage.createdAt,
    });
  }

  const providerRun: ProviderRun = {
    id: runId,
    sessionId,
    provider,
    model: spawnModel,
    status: { kind: 'streaming', startedAt: now() },
    routingDecision,
    createdAt: now(),
  };
  await insertProviderRun(tauriDatabase, providerRun);

  if (claimTurnStart({ agentId: activeAgentId }) === 'cancelled') {
    await updateProviderRunStatus(tauriDatabase, runId, {
      kind: 'cancelled',
      finishedAt: now(),
    });
    return turnDone({ result: NOT_BLOCKED });
  }

  let resolvedAgentId: AgentId | null = null;
  if (phaseDefinition) {
    const runsForSession = get().sessionPhaseRuns[sessionId] ?? [];
    const scopedRuns = phaseWorkflowRunId
      ? runsForWorkflowRun(runsForSession, phaseWorkflowRunId)
      : runsForSession;
    const reusable = findReusableAgent(scopedRuns, phaseDefinition.id);
    let resolved: Agent | null = null;
    try {
      resolved =
        (await resolvePhaseAgent({
          sessionId,
          definition: phaseDefinition,
          workflowRunId: phaseWorkflowRunId,
          reusable,
          providerRunId: runId,
          now,
        })) ?? null;
    } catch (error) {
      console.error('resolvePhaseAgent failed', error);
    }
    if (resolved === null) {
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
    if (phaseTransitionEvent) {
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
  return turnReady({ value: { runId, isFirstTurn, isHandoffTurn, resolvedAgentId } });
};

export type StartedTurn = TurnPhaseValue<typeof startTurnRun>;
