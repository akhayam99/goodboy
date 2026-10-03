import { autoPopulateContext } from '@goodboy/core';
import {
  countUserTextEvents,
  listContextSlotsForSession,
  updateProviderRunStatus,
  updateSessionState,
  upsertContextSlot,
} from '@goodboy/db';
import type { TurnState } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { worktreeChangedFiles } from '../../../features/worktree/worktree';
import { cursorMaxModeAdvisory } from '../../../shared/lib/cursorMaxModeAdvisory';
import { applyAgentTurnState, cancelledRunIds } from '../sessions/sessionMutators';
import { captureMaterializeRequestsFromTurn } from './turnHelpers';
import { resolveMountBaseBranch } from '../project-mounts/selectors';
import { completeResolvedAgent } from './completeResolvedAgent';
import { recordTurnSpan } from './recordTurnSpan';
import { turnSpanEndReason } from './turnSpanEndReason';
import type { GetFn, SetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';
import type { TurnContext } from './turnContext';

const FILES_TOUCHED_NUMSTAT_SLOT = 'files_touched_numstat';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  ctx: TurnContext;
}>;

export const finalizeTurnStream = async ({ set, get, ctx }: Params) => {
  const { sessionId } = ctx.input;
  const {
    session,
    activeMount,
    turnMountId,
    copyPath,
    workingDir,
    now,
    activeAgentId,
    provider,
    modelSelection,
    runId,
    resolvedAgentId,
    agentRowEarly,
    resolveAttemptId,
    progress,
    resolveCandidateWriter,
    isSessionDirScope,
    turnSpanBase,
    touchedMountsForTurn,
  } = ctx;
  const { assistantText, receivedProviderError, receivedStreamError, filesTouchedThisTurn } =
    progress;
  const turnEndedAt = now();
  await resolveCandidateWriter.flush();
  const afterAgentState = get().agentTurnState[activeAgentId];
  if (afterAgentState?.kind === 'running') {
    const idleState: TurnState = { kind: 'idle', lastActivityAt: now() };
    const derived = applyAgentTurnState(set, sessionId, activeAgentId, idleState, now());
    await updateSessionState(tauriDatabase, sessionId, derived, now());
    if (assistantText.length === 0 && !receivedProviderError) {
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'error',
        runId,
        message: 'provider exited without a response. check that the CLI is configured correctly.',
        retryable: false,
        at: now(),
      });
    }
  }
  const wasCancelled = cancelledRunIds.delete(runId);
  progress.turnWasCancelled = wasCancelled;
  await recordTurnSpan({
    get,
    span: {
      ...turnSpanBase,
      endedAt: turnEndedAt,
      endReason: turnSpanEndReason({ wasCancelled, assistantText }),
      touchedMountIds: await touchedMountsForTurn(),
    },
  });
  if (
    provider === 'cursor' &&
    receivedProviderError === false &&
    wasCancelled === false &&
    assistantText.length > 0
  ) {
    cursorMaxModeAdvisory.clear({
      accountId: get().authResults?.cursor?.identity ?? 'unknown',
      model: modelSelection.key,
    });
  }
  await updateProviderRunStatus(
    tauriDatabase,
    runId,
    wasCancelled
      ? { kind: 'failed', finishedAt: now(), error: 'cancelled by user' }
      : { kind: 'succeeded', finishedAt: now() },
  );
  if (!wasCancelled && assistantText.length > 0) {
    await captureMaterializeRequestsFromTurn({
      get,
      sessionId,
      agentId: activeAgentId,
      runId,
      assistantText,
      boundMountId: turnMountId,
    });
  }
  if (resolvedAgentId && !wasCancelled) {
    const shouldAutoAdvance = await completeResolvedAgent({
      set,
      get,
      sessionId,
      resolvedAgentId,
      assistantText,
      didAgentDie: receivedStreamError || assistantText.trim().length === 0,
      resolveAttemptId,
      now,
    });
    if (shouldAutoAdvance !== null) {
      progress.shouldAutoAdvanceWorkflow = shouldAutoAdvance;
    }
  }
  if (resolvedAgentId && wasCancelled) {
    const refreshedRuns = await invokeAgentList(sessionId);
    set((state) => ({
      sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
    }));
  }

  try {
    const stateForAgentCtx = get();
    const activeAgentRow =
      (stateForAgentCtx.sessionPhaseRuns[sessionId] ?? []).find((r) => r.id === activeAgentId) ??
      null;
    const stepLookup = (() => {
      if (!activeAgentRow?.stepId) {
        return undefined;
      }
      const templates = stateForAgentCtx.phaseTemplates[session.workspaceId] ?? [];
      const sess = sessionById(stateForAgentCtx.sessions, sessionId);
      const run = activeAgentRow.workflowRunId
        ? sess?.workflowRuns.find((r) => r.id === activeAgentRow.workflowRunId)
        : undefined;
      const template = run ? templates.find((t) => t.id === run.workflowId) : undefined;
      const step = template?.steps.find((s) => s.id === activeAgentRow.stepId);
      if (template && step) {
        return { workflowId: template.id, ordinal: step.ordinal };
      }
      return undefined;
    })();
    const transcriptTurnOrdinal = (get().transcripts[activeAgentId] ?? []).filter(
      (e) => e.kind === 'user_text',
    ).length;
    let turnOrdinal = transcriptTurnOrdinal;
    try {
      turnOrdinal = await countUserTextEvents({
        db: tauriDatabase,
        agentId: activeAgentId,
      });
    } catch {
      turnOrdinal = transcriptTurnOrdinal;
    }
    const result = await autoPopulateContext({
      db: tauriDatabase,
      sessionId,
      filesEdited: Array.from(filesTouchedThisTurn),
      assistantText,
      agentContext: {
        agentId: activeAgentId,
        workflowId: stepLookup?.workflowId,
        ...(activeAgentRow?.workflowRunId != null && {
          workflowRunId: activeAgentRow.workflowRunId,
        }),
        stepOrdinal: stepLookup?.ordinal,
        turnOrdinal,
      },
    });
    if (result.updatedSlots.length > 0) {
      const refreshedSlots = await listContextSlotsForSession(tauriDatabase, sessionId);
      set((state) => ({
        sessionSlots: { ...state.sessionSlots, [sessionId]: refreshedSlots },
      }));
    }
    await get().noteDecisionChanges({
      sessionId,
      changes: result.decisionChanges,
      agentId: activeAgentId,
    });
    if (result.openQuestionsChanged) {
      await get().loadSessionOpenQuestions(sessionId);
      if (resolveAttemptId !== undefined && agentRowEarly !== null && !wasCancelled) {
        await get().persistResolveTurn({
          sessionId,
          agent: agentRowEarly,
          assistantText,
          attemptId: resolveAttemptId,
        });
      }
    }
    if (activeMount !== undefined && !isSessionDirScope && copyPath === null) {
      try {
        const changed = await worktreeChangedFiles({
          worktreePath: workingDir,
          baseBranch: resolveMountBaseBranch({
            mount: activeMount,
            projects: get().projects,
          }),
        });
        await upsertContextSlot(
          tauriDatabase,
          sessionId,
          { key: FILES_TOUCHED_NUMSTAT_SLOT, value: changed.numstat, enabled: true },
          'summarizer',
        );
        const refreshedSlots = await listContextSlotsForSession(tauriDatabase, sessionId);
        set((state) => ({
          sessionSlots: { ...state.sessionSlots, [sessionId]: refreshedSlots },
        }));
      } catch (e) {
        console.error('files_touched_numstat slot write failed', e);
      }
    }
  } catch (e) {
    console.error('autoPopulateContext failed', e);
  }
};
