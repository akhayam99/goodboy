import { formatError } from '@goodboy/ui';
import { insertMessage } from '@goodboy/db';
import type { Message, MessageId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { detectDrift } from '../../../features/session/drift-detection';
import { purgedAgentIds } from '../sessions/sessionMutators';
import { sessionAwaitsPullRequest } from '../github/sessionAwaitsPullRequest';
import {
  captureArtifactsFromTurn,
  captureScoutDomainsFromTurn,
  emitTurnNudges,
  enqueueSummarizer,
} from './turnHelpers';
import type { GetFn, SetFn } from './types';
import {
  expectsArtifact,
  isAgentMissingArtifact,
  MISSING_ARTIFACT_CODE,
  MISSING_ARTIFACT_MESSAGE,
} from '../../../features/artifacts/turnArtifactOutcome';
import { NOT_BLOCKED } from './notBlocked';
import type { TurnContext } from './turnContext';
import { enqueueLearnings } from './learningQueue';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  ctx: TurnContext;
}>;

export const settleTurn = async ({ set, get, ctx }: Params) => {
  const { sessionId } = ctx.input;
  const {
    rewriterCopy,
    workingDir,
    now,
    activeAgentId,
    phaseWorkflowRunId,
    provider,
    isScribeTurn,
    runId,
    agentRowEarly,
    earlyAgentKind,
    resolveAttemptId,
    resolvedPrompt,
  } = ctx;
  const {
    assistantText,
    lastError,
    turnWasCancelled,
    shouldAutoAdvanceWorkflow,
    filesTouchedThisTurn,
  } = ctx.progress;
  if (isScribeTurn && !turnWasCancelled) {
    void get()
      .settleScribe({
        sessionId,
        agentId: activeAgentId,
        assistantText,
        hasFailed: lastError !== null,
      })
      .catch(() => undefined);
  }

  if (rewriterCopy !== null && !turnWasCancelled) {
    void get()
      .settleHistoryRewriter({
        sessionId,
        agentId: activeAgentId,
        assistantText,
        hasFailed: lastError !== null,
      })
      .catch(() => undefined);
  }

  if (assistantText.length > 0 && !purgedAgentIds.has(activeAgentId)) {
    const assistantMessage: Message = {
      id: crypto.randomUUID() as MessageId,
      sessionId,
      agentId: activeAgentId,
      role: 'assistant',
      content: assistantText,
      createdAt: now(),
    };
    await insertMessage(tauriDatabase, assistantMessage);
  }

  if (!lastError && !turnWasCancelled && assistantText.length > 0) {
    enqueueSummarizer({
      set,
      get,
      sessionId,
      turnInput: resolvedPrompt,
      turnOutput: assistantText,
      workingDir,
      agentId: activeAgentId,
    });
    enqueueLearnings({
      set,
      get,
      sessionId,
      agentId: activeAgentId,
      entry: {
        role: ctx.turnRole,
        turnOrdinal: (get().transcripts[activeAgentId] ?? []).filter(
          (event) => event.kind === 'user_text',
        ).length,
        topics: ctx.explainMoreTopics,
        turnInput: ctx.input.content,
        turnOutput: assistantText,
        workingDir,
      },
    });
    const captured = await captureArtifactsFromTurn({
      set,
      sessionId,
      agentId: activeAgentId,
      agentName: agentRowEarly?.name ?? null,
      assistantText,
      emittingProvider: provider,
      sourceTurnId: runId,
      workflowRunId: phaseWorkflowRunId ?? undefined,
    });
    const capturedPlan = captured.plan;
    if (captured.error !== null) {
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'artifact_capture_failed',
        runId,
        code: captured.error.code,
        message: captured.error.message,
        at: now(),
      });
    }
    const settledAgentRow =
      (get().sessionPhaseRuns[sessionId] ?? []).find((row) => row.id === activeAgentId) ?? null;
    if (
      captured.error !== null &&
      settledAgentRow !== null &&
      settledAgentRow.status === 'completed' &&
      earlyAgentKind !== 'planner' &&
      expectsArtifact({ kind: earlyAgentKind })
    ) {
      await invokeAgentUpdateStatus(settledAgentRow.id, {
        status: 'blocked',
        completedAt: now(),
      });
      const blockedRuns = await invokeAgentList(sessionId);
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: blockedRuns },
      }));
    }
    if (
      captured.error === null &&
      captured.plan === null &&
      captured.artifact === null &&
      settledAgentRow !== null &&
      isAgentMissingArtifact({
        agent: settledAgentRow,
        kind: earlyAgentKind,
        artifacts: get().sessionArtifacts?.[sessionId],
      })
    ) {
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'artifact_capture_failed',
        runId,
        code: MISSING_ARTIFACT_CODE,
        message: MISSING_ARTIFACT_MESSAGE,
        at: now(),
      });
    }
    await captureScoutDomainsFromTurn({
      set,
      sessionId,
      agentId: activeAgentId,
      agentKind: earlyAgentKind,
      assistantText,
    });
    void emitTurnNudges(set, get, sessionId, activeAgentId, assistantText, capturedPlan);
    const driftViolations = detectDrift({
      agentKind: earlyAgentKind,
      assistantText,
      filesEdited: Array.from(filesTouchedThisTurn),
    });
    if (driftViolations.length > 0) {
      void get().emitNotification({
        kind: 'boundary-drift',
        severity: 'warning',
        title: `${agentRowEarly?.name ?? 'Agent'} drifted from ${earlyAgentKind} role`,
        body: driftViolations[0]!.detail,
        sessionId,
        ...(activeAgentId != null && {
          action: { kind: 'open-agent' as const, sessionId, agentId: activeAgentId },
        }),
      });
    }
    if (
      sessionAwaitsPullRequest({ state: get(), sessionId }) &&
      /github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/.test(assistantText)
    ) {
      void get()
        .refreshSessionPr(sessionId, { force: true })
        .then(() => void get().refreshSessionPrDetail(sessionId, { force: true }));
    }
  }

  void get().recheckSessionMounts({ sessionId, reason: 'turn-end' });

  if (!lastError && shouldAutoAdvanceWorkflow) {
    void get().maybeAutoAdvanceWorkflow(sessionId);
  }

  if (resolveAttemptId !== undefined && (lastError !== null || turnWasCancelled)) {
    await get().recordResolvePhase({
      sessionId,
      agentId: activeAgentId,
      attemptId: resolveAttemptId,
      phase: turnWasCancelled ? 'cancelled' : 'failed',
      error: lastError === null ? null : formatError(lastError),
      failureCause: 'provider_error',
    });
  }
  if (lastError) {
    throw lastError;
  }
  return NOT_BLOCKED;
};
