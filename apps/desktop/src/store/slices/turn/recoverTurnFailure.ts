import {
  fallbackWantsThinker,
  planTurnFallback,
  resolveRoleRouting,
  resolveStoredModelSelection,
} from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import { updateProviderRunStatus, updateSessionState } from '@goodboy/db';
import type { TurnState } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import {
  providersCoolingDown,
  withProviderCooldown,
} from '../../../features/providers/taskModelRouting';
import { classifyProviderError } from '../../../features/chat/classifyProviderError';
import { createTranscriptOwnedTurnError } from '../../../features/chat/turn-errors';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { KIND_TO_ROLE } from '../../../features/session/agent-kind';
import { cursorMaxModeAdvisory } from '../../../shared/lib/cursorMaxModeAdvisory';
import { applyAgentTurnState, cancelledRunIds } from '../sessions/sessionMutators';
import { captureMaterializeRequestsFromTurn } from './turnHelpers';
import { resolveErrorTurnMessage } from './resolveErrorTurnMessage';
import { learnFromCliRefusal } from './learnFromCliRefusal';
import { fallbackNoticeMessage } from './fallbackNoticeMessage';
import { cursorMaxModeMessage, matchCursorMaxModeFailure } from './matchCursorMaxModeFailure';
import { recordTurnSpan } from './recordTurnSpan';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import type { GetFn, SendTurnResult, SetFn, SendTurnInput, TurnLease } from './types';
import { formatClock } from '../../../shared/utils/time/formatClock';
import type { TurnContext } from './turnContext';

const MIN_USAGE_LIMIT_RETRY_MS = 1_000;
const MAX_TIMEOUT_MS = 2_147_483_647;

const formatResetTime = ({ resetAtMs }: { readonly resetAtMs: number }): string =>
  formatClock({ at: resetAtMs });

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  lease: TurnLease;
  ctx: TurnContext;
  err: unknown;
  runOnce: (params: {
    readonly input: SendTurnInput;
    readonly lease: TurnLease;
  }) => Promise<SendTurnResult>;
  run: (input: SendTurnInput) => Promise<SendTurnResult>;
}>;

export const recoverTurnFailure = async ({ set, get, lease, ctx, err, runOnce, run }: Params) => {
  const { sessionId, content, attachments, override, force, origin, retry } = ctx.input;
  const {
    session,
    turnTarget,
    turnMountId,
    copyPath,
    now,
    activeAgentId,
    attachmentRefs,
    phaseDefinition,
    provider,
    spawnModel,
    connectedProviders,
    runId,
    resolvedAgentId,
    earlyAgentKind,
    progress,
    turnSpanBase,
    touchedMountsForTurn,
  } = ctx;
  const { assistantText } = progress;
  const rawMessage = formatError(err);
  const maxModeFailure =
    provider === 'cursor' ? matchCursorMaxModeFailure({ message: rawMessage }) : null;
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
  learnFromCliRefusal({ get, providerId: provider, model: spawnModel, message: rawMessage });
  const cancelledBeforeFailure = cancelledRunIds.delete(runId);
  await recordTurnSpan({
    get,
    span: {
      ...turnSpanBase,
      endedAt: now(),
      endReason: cancelledBeforeFailure ? 'cancelled' : 'failed',
      touchedMountIds: await touchedMountsForTurn(),
    },
  });
  const failure = classifyProviderError({ message: rawMessage });
  const usageLimitResetAtMs = failure.kind === 'usage_limit' ? (failure.resetAtMs ?? null) : null;
  if (failure.kind === 'usage_limit') {
    set((state) => ({
      providerCooldowns: withProviderCooldown({
        cooldowns: state.providerCooldowns,
        provider,
        cooldownUntilMs: usageLimitResetAtMs,
      }),
    }));
  }
  const fallbackRole = phaseDefinition?.role ?? KIND_TO_ROLE[earlyAgentKind];
  const preferredFallback = resolveRoleRouting({
    role: fallbackRole,
    prefs: selectResolvedSettings({ state: get(), sessionId })?.roleModels ?? null,
  }).fallback;
  const fallbackPlan = cancelledBeforeFailure
    ? null
    : planTurnFallback({
        failure: failure.kind,
        provider,
        model: spawnModel,
        connectedProviders,
        attempt: retry?.attempt ?? 0,
        wantsThinker: fallbackWantsThinker({ role: fallbackRole }),
        enabledProviders: session.providerPreference.enabledProviders ?? null,
        coolingDownProviders: providersCoolingDown({
          cooldowns: get().providerCooldowns,
          nowMs: Date.now(),
        }),
        ...(preferredFallback != null && {
          preferred: {
            provider: preferredFallback.provider,
            model: preferredFallback.model,
          },
        }),
      });
  const message =
    maxModeFailure != null
      ? cursorMaxModeMessage(maxModeFailure)
      : resolveErrorTurnMessage({
          message: rawMessage,
          providerId: provider,
          identity: get().authResults?.[provider]?.identity ?? null,
          model: spawnModel,
          fallbackModel:
            fallbackPlan != null && fallbackPlan.provider === provider ? fallbackPlan.model : null,
        });
  if (fallbackPlan != null) {
    await updateProviderRunStatus(tauriDatabase, runId, {
      kind: 'failed',
      finishedAt: now(),
      error: rawMessage,
    });
    const isGenericPassthroughFailure =
      failure.kind === 'rate_limit' ||
      failure.kind === 'usage_limit' ||
      failure.kind === 'unreachable' ||
      failure.kind === 'other';
    if (!isGenericPassthroughFailure) {
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'error',
        runId,
        message,
        retryable: false,
        at: now(),
      });
    }
    const isNamedInRefusal =
      maxModeFailure == null &&
      failure.kind === 'cli_too_old' &&
      fallbackPlan.provider === provider;
    if (!isNamedInRefusal) {
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'decision_note',
        runId,
        message: fallbackNoticeMessage({
          provider,
          failure: failure.kind,
          plan: fallbackPlan,
        }),
        at: now(),
      });
    }
    const retryState: TurnState = { kind: 'idle', lastActivityAt: now() };
    const retryDerived = applyAgentTurnState(set, sessionId, activeAgentId, retryState, now());
    await updateSessionState(tauriDatabase, sessionId, retryDerived, now());
    return await runOnce({
      input: {
        sessionId,
        agentId: activeAgentId,
        content,
        ...(attachments !== undefined && { attachments }),
        ...(override !== undefined && { override }),
        ...(force === true ? { force: true } : {}),
        ...(origin !== undefined && { origin }),
        ...(turnTarget !== null && { mountTarget: turnTarget }),
        ...(copyPath !== null && { resolveCopyPath: copyPath }),
        retry: {
          attempt: (retry?.attempt ?? 0) + 1,
          provider: fallbackPlan.provider,
          model: fallbackPlan.model,
          attachmentRefs,
        },
      },
      lease,
    });
  }
  if (failure.kind === 'usage_limit' && !cancelledBeforeFailure) {
    const resetLabel =
      usageLimitResetAtMs != null ? formatResetTime({ resetAtMs: usageLimitResetAtMs }) : null;
    void get()
      .emitNotification({
        kind: 'error',
        severity: 'warning',
        title: 'Provider at its usage limit',
        body:
          resetLabel != null
            ? `${PROVIDER_LABEL[provider]} is at its usage limit. Retrying at ${resetLabel}.`
            : `${PROVIDER_LABEL[provider]} is at its usage limit. Retry it when the limit resets.`,
        sessionId,
        workspaceId: session.workspaceId,
        coalesceKey: `provider-usage-limit:${provider}`,
      })
      .catch(() => undefined);
    if (usageLimitResetAtMs != null) {
      const delayMs = Math.min(
        Math.max(usageLimitResetAtMs - Date.now(), MIN_USAGE_LIMIT_RETRY_MS),
        MAX_TIMEOUT_MS,
      );
      setTimeout(() => {
        void run({
          sessionId,
          agentId: activeAgentId,
          content,
          ...(override !== undefined && { override }),
          ...(force === true ? { force: true } : {}),
          ...(origin !== undefined && { origin }),
          ...(turnTarget !== null && { mountTarget: turnTarget }),
          retry: {
            attempt: 0,
            provider,
            model: spawnModel,
            attachmentRefs,
          },
        }).catch(() => undefined);
      }, delayMs);
    }
  }
  const errorState: TurnState = {
    kind: 'error',
    message,
    failedAt: now(),
  };
  const derived = applyAgentTurnState(set, sessionId, activeAgentId, errorState, now());
  await updateSessionState(tauriDatabase, sessionId, derived, now());
  await updateProviderRunStatus(tauriDatabase, runId, {
    kind: 'failed',
    finishedAt: now(),
    error: rawMessage,
  });
  get().appendTurnEvent(activeAgentId, sessionId, {
    kind: 'error',
    runId,
    message,
    retryable: true,
    at: now(),
  });
  if (resolvedAgentId) {
    const isStoppedByUser =
      cancelledBeforeFailure &&
      (get().sessionPhaseRuns[sessionId] ?? []).some(
        (agent) => agent.id === resolvedAgentId && agent.status === 'stopped',
      );
    if (!isStoppedByUser) {
      await invokeAgentUpdateStatus(resolvedAgentId, {
        status: 'failed',
        completedAt: now(),
      });
    }
    const refreshedRuns = await invokeAgentList(sessionId);
    set((state) => ({
      sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
    }));
    void get().refreshUnreadWorkspaces();
  }
  progress.lastError = createTranscriptOwnedTurnError({ message: rawMessage, cause: err });
  if (!cancelledBeforeFailure && assistantText.length > 0) {
    try {
      await captureMaterializeRequestsFromTurn({
        get,
        sessionId,
        agentId: activeAgentId,
        runId,
        assistantText,
        boundMountId: turnMountId,
      });
    } catch (materializationError) {
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'error',
        runId,
        message: `materialize failed: ${formatError(materializationError)}`,
        at: now(),
      });
    }
  }
  return null;
};
