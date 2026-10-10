import { resolveStoredModelSelection, turnReducer } from '@goodboy/core';
import { updateSessionState } from '@goodboy/db';
import type { TurnEvent } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { runTurn } from '../../../features/chat/turn';
import { cursorMaxModeAdvisory } from '../../../shared/lib/cursorMaxModeAdvisory';
import { applyAgentTurnState } from '../sessions/sessionMutators';
import { toRelPath } from './turnHelpers';
import { auditToolCall } from './auditToolCall';
import { resolveErrorTurnMessage } from './resolveErrorTurnMessage';
import { learnFromCliRefusal } from './learnFromCliRefusal';
import { classifyToolCallFailure, toolCallFailureMessage } from './classifyToolCallFailure';
import { cursorMaxModeMessage, matchCursorMaxModeFailure } from './matchCursorMaxModeFailure';
import { feedAuthRefusal } from '../providers/feedAuthRefusal';
import { recordUsageTelemetry } from './recordUsageTelemetry';
import { codexMeasuredUsage } from './codexMeasuredUsage';
import type { GetFn, SetFn } from './types';
import type { TurnContext } from './turnContext';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  ctx: TurnContext;
}>;

export const readTurnStream = async ({ set, get, ctx }: Params) => {
  const { sessionId } = ctx.input;
  const {
    session,
    rewriterCopy,
    turnMountId,
    copyPath,
    workingDir,
    now,
    activeAgentId,
    provider,
    model,
    spawnModel,
    resolvedModel,
    effortFlag,
    apiKeyBinding,
    isScribeTurn,
    writerLease,
    runId,
    providerInfo,
    claudeFlags,
    effectiveRules,
    progress,
    resolveCandidateWriter,
    resumeSessionId,
    fullSystemPrompt,
    writableRoots,
    isolatedCopyPath,
    turnSpanBase,
    resolvedPrompt,
  } = ctx;
  const { filesTouchedThisTurn, editedPathsThisTurn } = progress;
  for await (const rawEvent of runTurn(
    {
      runId,
      provider,
      model: spawnModel,
      workingDir,
      writableRoots,
      prompt: resolvedPrompt,
      binary: providerInfo?.binary,
      workspaceId: session.workspaceId,
      sessionId,
      ...(turnMountId !== null && copyPath === null && { mountId: turnMountId }),
      ...(resumeSessionId !== undefined && { resumeSessionId }),
      systemPrompt: fullSystemPrompt,
      ...(effortFlag !== undefined && { effort: effortFlag }),
      ...(resolvedModel.maxMode === true && { cursorMaxMode: true }),
      ...(writerLease !== undefined && { writerLease }),
      ...((isolatedCopyPath !== null || isScribeTurn) && { blocksPush: true }),
      ...(rewriterCopy !== null && { excludesTmp: true }),
      ...(apiKeyBinding ?? {}),
      ...claudeFlags,
    },
    now,
    {
      onProviderLimits: (limits) => void get().recordProviderLimits({ limits }),
      owner: {
        agentId: turnSpanBase.agentId,
        sessionId: turnSpanBase.sessionId,
        workspaceId: turnSpanBase.workspaceId,
        workflowRunId: turnSpanBase.workflowRunId,
        stepRole: turnSpanBase.stepRole,
        provider,
        model: turnSpanBase.model,
        effort: turnSpanBase.effort,
        startedAt: turnSpanBase.startedAt,
        workingDir,
        mountId: turnMountId,
      },
    },
  )) {
    const maxModeFailure =
      provider === 'cursor' && rawEvent.kind === 'error'
        ? matchCursorMaxModeFailure({ message: rawEvent.message })
        : null;
    if (maxModeFailure != null) {
      const advisorySelection = resolveStoredModelSelection({
        provider: 'cursor',
        id: maxModeFailure.model,
      });
      cursorMaxModeAdvisory.mark({
        accountId: get().authResults?.cursor?.identity ?? 'unknown',
        model:
          advisorySelection.report?.kind === 'unknown'
            ? maxModeFailure.model
            : advisorySelection.selection.key,
      });
    }
    const resolvedEvent: TurnEvent =
      rawEvent.kind === 'error'
        ? {
            ...rawEvent,
            message:
              maxModeFailure != null
                ? cursorMaxModeMessage(maxModeFailure)
                : resolveErrorTurnMessage({
                    message: rawEvent.message,
                    providerId: provider,
                    identity: get().authResults?.[provider]?.identity ?? null,
                    model: spawnModel,
                  }),
          }
        : rawEvent;
    if (rawEvent.kind === 'error') {
      learnFromCliRefusal({
        get,
        providerId: provider,
        model: spawnModel,
        message: rawEvent.message,
      });
      feedAuthRefusal({
        set,
        get,
        providerId: provider,
        runId,
        message: rawEvent.message,
      });
    }
    const event: TurnEvent =
      resolvedEvent.kind === 'provider_session_init'
        ? { ...resolvedEvent, provider }
        : resolvedEvent;
    get().appendTurnEvent(activeAgentId, sessionId, event);
    if (event.kind === 'provider_session_init') {
      progress.providerThreadId = event.providerSessionId;
    }
    if (event.kind === 'error') {
      progress.receivedProviderError = true;
      progress.receivedStreamError = true;
    }
    if (event.kind === 'tool_call_end' && event.isError === true) {
      const toolCallFailure = classifyToolCallFailure({ output: event.output });
      const toolCallFailureText = toolCallFailureMessage(toolCallFailure);
      if (toolCallFailureText !== null) {
        get().appendTurnEvent(activeAgentId, sessionId, {
          kind: 'error',
          runId,
          message: toolCallFailureText,
          retryable: true,
          at: now(),
        });
        progress.receivedProviderError = true;
      }
    }
    if (event.kind === 'assistant_text') {
      progress.assistantText += event.delta;
      resolveCandidateWriter.append({ delta: event.delta });
    }
    if (event.kind === 'file_edit') {
      filesTouchedThisTurn.add(toRelPath(event.path, workingDir));
      editedPathsThisTurn.add(event.path);
    }

    if (provider === 'anthropic' && event.kind === 'tool_call_start') {
      await auditToolCall(set, get, {
        event,
        runId,
        sessionId,
        workspaceId: session.workspaceId,
        effectiveRules,
      });
    }

    if (event.kind === 'usage') {
      await recordUsageTelemetry(set, get, {
        event: await codexMeasuredUsage({ event, provider, threadId: progress.providerThreadId }),
        provider,
        model,
        runId,
        sessionId,
        now,
      });
      if (provider === 'codex') {
        void get().refreshCodexLimits();
      }
    }

    const currentAgentState = get().agentTurnState[activeAgentId];
    if (currentAgentState?.kind === 'running') {
      const reduced = turnReducer(currentAgentState, { kind: 'receive_event', event });
      if (reduced !== currentAgentState) {
        const derived = applyAgentTurnState(set, sessionId, activeAgentId, reduced, now());
        await updateSessionState(tauriDatabase, sessionId, derived, now());
      }
    }
  }
};
