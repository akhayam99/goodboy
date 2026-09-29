import { turnReducer } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import { insertMessage, updateProviderRunStatus, updateSessionState } from '@goodboy/db';
import type {
  AgentId,
  IsoDateTime,
  Message,
  MessageId,
  ProviderRunId,
  SessionId,
  TurnEvent,
  TurnState,
} from '@goodboy/types';
import { attachTurn } from '../../../features/chat/turn';
import type { TurnCursor, TurnOwner } from '../../../features/chat/turnCursor';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { tauriDatabase } from '../../../shared/lib/db';
import { applyAgentTurnState, cancelledRunIds, purgedAgentIds } from '../../session-mutators';
import {
  captureArtifactsFromTurn,
  captureMaterializeRequestsFromTurn,
  enqueueSummarizer,
} from '../../turn-helpers';
import { selectWritableMounts } from '../project-mounts/selectors';
import { flushTurnEvents } from '../transcripts/buffer';
import { collectTouchedMounts } from './collectTouchedMounts';
import { completeResolvedAgent } from './completeResolvedAgent';
import { recordTurnSpan } from './recordTurnSpan';
import { recordUsageTelemetry } from './recordUsageTelemetry';
import { snapshotMountChanges } from './snapshotMountChanges';
import { markTurnActive, markTurnSettled } from './turnSettled';
import { turnSpanEndReason } from './turnSpanEndReason';
import { isTurnWritableMount } from './turnWritableRoots';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly runId: ProviderRunId;
  readonly cursor: TurnCursor & { readonly owner: TurnOwner };
};

const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

const lastUserText = ({ events }: { readonly events: ReadonlyArray<TurnEvent> }): string => {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.kind === 'user_text') {
      return event.text;
    }
  }
  return '';
};

type RefreshParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
};

const refreshAgents = async ({ set, sessionId }: RefreshParams): Promise<void> => {
  const refreshed = await invokeAgentList(sessionId).catch(() => null);
  if (refreshed === null) {
    return;
  }
  set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed } }));
};

type SetStateParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly state: TurnState;
};

const writeTurnState = async ({ set, sessionId, agentId, state }: SetStateParams) => {
  const derived = applyAgentTurnState(set, sessionId, agentId, state, now());
  await updateSessionState(tauriDatabase, sessionId, derived, now()).catch(() => undefined);
};

export const reattachLiveTurn = async ({ set, get, runId, cursor }: Params): Promise<void> => {
  const { owner } = cursor;
  const { agentId, sessionId } = owner;
  markTurnActive({ agentId });
  const prepared = await (async () => {
    const idle: TurnState = { kind: 'idle', lastActivityAt: now() };
    await writeTurnState({
      set,
      sessionId,
      agentId,
      state: turnReducer(idle, { kind: 'send', runId, at: now() }),
    });
    const writableMounts = selectWritableMounts({ state: get(), sessionId }).filter(
      isTurnWritableMount,
    );
    return {
      mounts: writableMounts,
      before: snapshotMountChanges({ mounts: writableMounts, projects: get().projects }),
    };
  })().catch((error: unknown) => {
    markTurnSettled({ agentId });
    throw error;
  });
  const { mounts, before: mountChangesBefore } = prepared;
  const editedPaths = new Set<string>();
  let assistantText = '';
  let receivedProviderError = false;
  let failure: unknown = null;
  try {
    for await (const event of attachTurn({
      runId,
      provider: owner.provider,
      cursor,
      hooks: { onProviderLimits: (limits) => void get().recordProviderLimits({ limits }) },
    })) {
      get().appendTurnEvent(agentId, sessionId, event);
      if (event.kind === 'error') {
        receivedProviderError = true;
      }
      if (event.kind === 'assistant_text') {
        assistantText += event.delta;
      }
      if (event.kind === 'file_edit') {
        editedPaths.add(event.path);
      }
      if (event.kind === 'usage') {
        await recordUsageTelemetry(set, get, {
          event,
          provider: owner.provider,
          model: owner.model,
          runId,
          sessionId,
          now,
        });
      }
      const current = get().agentTurnState[agentId];
      if (current?.kind === 'running') {
        const reduced = turnReducer(current, { kind: 'receive_event', event });
        if (reduced !== current) {
          await writeTurnState({ set, sessionId, agentId, state: reduced });
        }
      }
    }
  } catch (error) {
    failure = error;
  } finally {
    flushTurnEvents();
  }
  try {
    const wasCancelled = cancelledRunIds.delete(runId);
    const touchedMountIds = await collectTouchedMounts({
      get,
      sessionId,
      agentId,
      mounts,
      workingDir: owner.workingDir,
      editedPaths: Array.from(editedPaths),
      before: mountChangesBefore,
      startedAt: owner.startedAt,
    });
    await recordTurnSpan({
      get,
      span: {
        runId,
        agentId,
        sessionId,
        workspaceId: owner.workspaceId,
        workflowRunId: owner.workflowRunId,
        stepRole: owner.stepRole,
        provider: owner.provider,
        model: owner.model,
        effort: owner.effort,
        startedAt: owner.startedAt,
        endedAt: now(),
        endReason: failure === null ? turnSpanEndReason({ wasCancelled, assistantText }) : 'failed',
        touchedMountIds,
      },
    });
    if (failure !== null) {
      const message = formatError(failure);
      await writeTurnState({
        set,
        sessionId,
        agentId,
        state: { kind: 'error', message, failedAt: now() },
      });
      await updateProviderRunStatus(tauriDatabase, runId, {
        kind: 'failed',
        finishedAt: now(),
        error: message,
      }).catch(() => undefined);
      get().appendTurnEvent(agentId, sessionId, {
        kind: 'error',
        runId,
        message,
        retryable: true,
        at: now(),
      });
      flushTurnEvents();
      if (!wasCancelled) {
        await invokeAgentUpdateStatus(agentId, { status: 'failed', completedAt: now() });
      }
      await refreshAgents({ set, sessionId });
      return;
    }
    await writeTurnState({
      set,
      sessionId,
      agentId,
      state: { kind: 'idle', lastActivityAt: now() },
    });
    await updateProviderRunStatus(
      tauriDatabase,
      runId,
      wasCancelled
        ? { kind: 'failed', finishedAt: now(), error: 'cancelled by user' }
        : { kind: 'succeeded', finishedAt: now() },
    ).catch(() => undefined);
    if (wasCancelled) {
      await refreshAgents({ set, sessionId });
      return;
    }
    if (assistantText.length > 0) {
      await captureMaterializeRequestsFromTurn({
        get,
        sessionId,
        agentId,
        runId,
        assistantText,
        boundMountId: owner.mountId,
      });
    }
    const shouldAutoAdvance = await completeResolvedAgent({
      set,
      get,
      sessionId,
      resolvedAgentId: agentId,
      assistantText,
      didAgentDie: receivedProviderError || assistantText.trim().length === 0,
      now,
    });
    if (assistantText.length > 0 && !purgedAgentIds.has(agentId)) {
      const message: Message = {
        id: crypto.randomUUID() as MessageId,
        sessionId,
        agentId,
        role: 'assistant',
        content: assistantText,
        createdAt: now(),
      };
      await insertMessage(tauriDatabase, message);
      enqueueSummarizer({
        set,
        get,
        sessionId,
        turnInput: lastUserText({ events: get().transcripts[agentId] ?? [] }),
        turnOutput: assistantText,
        workingDir: owner.workingDir,
      });
      const agentName =
        (get().sessionPhaseRuns[sessionId] ?? []).find((agent) => agent.id === agentId)?.name ??
        null;
      await captureArtifactsFromTurn({
        set,
        sessionId,
        agentId,
        agentName,
        assistantText,
        emittingProvider: owner.provider,
        sourceTurnId: runId,
        ...(owner.workflowRunId !== null && { workflowRunId: owner.workflowRunId }),
      });
    }
    if (shouldAutoAdvance === true) {
      void get().maybeAutoAdvanceWorkflow(sessionId);
    }
  } finally {
    markTurnSettled({ agentId });
    void get().drainAgentQueue({ sessionId, agentId });
  }
};
