import { invoke } from '@tauri-apps/api/core';
import {
  assessPlanReadiness,
  extractHandoff,
  extractPlanFromMarker,
  Summarizer,
  type ExtractedHandoff,
  type SlotKey,
} from '@goodboy/core';
import {
  insertContextSlotHistory,
  insertNudgeEvent,
  insertProviderRun,
  insertTelemetry,
  listContextSlotHistory,
  listContextSlotsForSession,
  listTelemetryForSession,
  renameSession as renameSessionInDb,
  summarizeSessionTelemetry,
  summarizeWorkspaceProviderTelemetry,
  summarizeWorkspaceTelemetry,
  updateProviderRunStatus,
  upsertContextSlot,
  type NudgeEvent,
  type NudgeKind,
} from '@goodboy/db';
import type {
  AgentId,
  ContextSlot,
  IsoDateTime,
  MessageAttachment,
  PlanId,
  PlanWithCount,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
} from '@goodboy/types';
import { tauriDatabase } from '../shared/lib/db';
import { invokeBudgetRuleList } from '../features/budget/budget';
import {
  listPlansForSession as invokeListPlansForSession,
  upsertPlan as invokeUpsertPlan,
} from '../features/plans/plans';
import { heuristicAgentTitle } from '../shared/lib/agent-title-heuristic';
import { formatError } from '../shared/lib/errors';
import { buildProviderSpendBreakdown } from './slices/budget';
import type { SessionNudge } from './store';
import type { SetFn, GetFn } from './slice-types';

// The provider CLIs have no API content-block channel, images reach the model
// only as files named in the prompt text. Paths stay worktree-relative so they
// resolve against the CLI's cwd and never trip the worktree-scope guard.
export function buildAttachmentPromptBlock(refs: ReadonlyArray<MessageAttachment>): string {
  const list = refs.map((r) => `- ${r.relPath}`).join('\n');
  return [
    '[attached-images]',
    `The user attached ${refs.length} image${refs.length === 1 ? '' : 's'} to this message.`,
    'Use your Read tool on each path below to view the image:',
    list,
    '[/attached-images]',
  ].join('\n');
}

export function toRelPath(absPath: string, workingDir: string): string {
  if (!workingDir) return absPath;
  const root = workingDir.endsWith('/') ? workingDir : `${workingDir}/`;
  return absPath.startsWith(root) ? absPath.slice(root.length) : absPath;
}

// Summarizer queue, one per task, max one in-flight + one queued (coalesced).
// Prevents stacking when the user iterates faster than the summarizer completes.
interface SummarizerQueueEntry {
  readonly turnInput: string;
  readonly turnOutput: string;
}

interface SummarizerTaskQueue {
  inFlight: boolean;
  queued: SummarizerQueueEntry | null;
}

export const summarizerQueues = new Map<SessionId, SummarizerTaskQueue>();

function scheduleIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => fn());
  } else {
    queueMicrotask(fn);
  }
}

export function enqueueSummarizer(
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  turnInput: string,
  turnOutput: string,
): void {
  let queue = summarizerQueues.get(sessionId);
  if (!queue) {
    queue = { inFlight: false, queued: null };
    summarizerQueues.set(sessionId, queue);
  }

  if (queue.inFlight) {
    // Coalesce: overwrite any previously queued entry with the latest.
    queue.queued = { turnInput, turnOutput };
    return;
  }

  queue.inFlight = true;
  queue.queued = null;

  const run = (): void => {
    void runSummarizer(set, get, sessionId, turnInput, turnOutput).finally(() => {
      const q = summarizerQueues.get(sessionId);
      if (!q) return;
      const next = q.queued;
      if (next) {
        q.queued = null;
        scheduleIdle(() => {
          void runSummarizer(set, get, sessionId, next.turnInput, next.turnOutput).finally(() => {
            const q2 = summarizerQueues.get(sessionId);
            if (q2) {
              q2.inFlight = false;
            }
          });
        });
      } else {
        q.inFlight = false;
      }
    });
  };

  scheduleIdle(run);
}

async function runSummarizer(
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  turnInput: string,
  turnOutput: string,
): Promise<void> {
  const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

  // Mark running without a separate set, merged into the final batch below on success,
  // or emitted immediately only on the error path. This avoids a spurious re-render at start.
  set((state) => {
    const prev = state.summarizerStatus[sessionId];
    return {
      summarizerStatus: {
        ...state.summarizerStatus,
        [sessionId]: {
          status: 'running',
          lastUpdate: prev?.lastUpdate ?? null,
          error: null,
          lastUsage: prev?.lastUsage ?? null,
          lastAttempt: { turnInput, turnOutput },
        },
      },
    };
  });

  try {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const providerId = session.providerPreference.defaultProvider;
    const summarizer = new Summarizer({ providerId, invokeFn: invoke });
    const prevSlots = get().sessionSlots[sessionId] ?? [];
    const ghPr = get().sessionGithub[sessionId]?.pr ?? null;
    const prState = ghPr
      ? {
          hasOpenPr: ghPr.state === 'open' || ghPr.state === 'draft' || ghPr.state === 'approved',
          checksGreen: ghPr.checks === 'success',
        }
      : null;
    const result = await summarizer.summarize({ prevSlots, turnInput, turnOutput, prState });

    const changedKeys = (
      await Promise.all(
        result.delta.upserts.map(async (upsert) => {
          const existing = (get().sessionSlots[sessionId] ?? []).find((s) => s.key === upsert.key);
          const prevValue = existing && existing.value !== upsert.value ? existing.value : null;
          if (prevValue !== null) {
            await insertContextSlotHistory(
              tauriDatabase,
              sessionId,
              crypto.randomUUID(),
              upsert.key,
              prevValue,
              'summarizer',
            );
          }
          const next: ContextSlot = {
            key: upsert.key,
            value: upsert.value,
            enabled: existing?.enabled ?? true,
          };
          await upsertContextSlot(tauriDatabase, sessionId, next);
          return prevValue !== null ? upsert.key : null;
        }),
      )
    ).filter((k): k is SlotKey => k !== null);

    // If the summarizer carried a GitHub PR URL into any slot value and we
    // still have no PR cached for this session, pull the PR state now so the
    // polling sweep picks it up on its next tick. Complements the same regex
    // run on raw assistant text post-turn, covers cases where the URL only
    // surfaces in the summarized context, not in the verbatim turn output.
    if (
      !get().sessionGithub[sessionId]?.pr &&
      result.delta.upserts.some((u) => /github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/.test(u.value))
    ) {
      void get()
        .refreshSessionPr(sessionId, { force: true })
        .then(() => void get().refreshSessionPrDetail(sessionId, { force: true }));
    }

    const summarizerRunId = crypto.randomUUID() as ProviderRunId;
    const startedAt = now();

    // Parallel: telemetry write + slot refresh + analytics queries.
    const [
      refreshed,
      ,
      sessionSummary,
      workspaceSummary,
      telemetry,
      providerSummaries,
      budgetRules,
      changedHistory,
    ] = await Promise.all([
      listContextSlotsForSession(tauriDatabase, sessionId),
      insertProviderRun(tauriDatabase, {
        id: summarizerRunId,
        sessionId,
        provider: providerId,
        model: result.model,
        status: { kind: 'streaming', startedAt },
        createdAt: startedAt,
      })
        .then(() =>
          updateProviderRunStatus(tauriDatabase, summarizerRunId, {
            kind: 'succeeded',
            finishedAt: now(),
          }),
        )
        .then(() => {
          const record: TelemetryRecord = {
            id: crypto.randomUUID() as TelemetryRecordId,
            runId: summarizerRunId,
            sessionId,
            kind: 'summarizer',
            provider: providerId,
            model: result.model,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            estimatedCostUsd: result.usage.estimatedCostUsd,
            recordedAt: now(),
          };
          return insertTelemetry(tauriDatabase, record);
        }),
      summarizeSessionTelemetry(tauriDatabase, sessionId),
      summarizeWorkspaceTelemetry(tauriDatabase, session.workspaceId),
      listTelemetryForSession(tauriDatabase, sessionId),
      summarizeWorkspaceProviderTelemetry(tauriDatabase, session.workspaceId),
      invokeBudgetRuleList(),
      Promise.all(
        changedKeys.map(
          async (key) =>
            [key, await listContextSlotHistory(tauriDatabase, sessionId, key)] as const,
        ),
      ),
    ]);

    // Single batched set, one re-render for the entire summarizer completion.
    set((state) => ({
      sessionSlots: { ...state.sessionSlots, [sessionId]: refreshed },
      slotHistory: {
        ...state.slotHistory,
        [sessionId]: {
          ...(state.slotHistory[sessionId] ?? {}),
          ...Object.fromEntries(changedHistory),
        },
      },
      sessionSummary,
      workspaceSummary,
      sessionTelemetry: { ...state.sessionTelemetry, [sessionId]: telemetry },
      summarizerStatus: {
        ...state.summarizerStatus,
        [sessionId]: {
          status: 'idle',
          lastUpdate: now(),
          error: null,
          lastUsage: {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            estimatedCostUsd: result.usage.estimatedCostUsd,
          },
          lastAttempt: null,
        },
      },
      sessionNextActions: { ...state.sessionNextActions, [sessionId]: result.nextActions },
      providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules),
    }));
    void get().emitNotification('summarizer-success', 'info', 'context summarized', undefined, {
      sessionId,
    });
  } catch (err) {
    // never log api key, only the error message
    const message = formatError(err);
    if (import.meta.env.DEV) {
      console.warn(`[summarizer] failed for session ${sessionId}: ${message}`);
    }
    set((state) => {
      const prev = state.summarizerStatus[sessionId];
      return {
        summarizerStatus: {
          ...state.summarizerStatus,
          [sessionId]: {
            status: 'error',
            lastUpdate: now(),
            error: message,
            lastUsage: prev?.lastUsage ?? null,
            lastAttempt: prev?.lastAttempt ?? { turnInput, turnOutput },
          },
        },
      };
    });
    void get().emitNotification('error', 'error', 'summarizer failed', message, {
      sessionId,
    });
  }
}

export async function capturePlanFromTurn(
  set: SetFn,
  sessionId: SessionId,
  agentId: AgentId,
  assistantText: string,
): Promise<PlanWithCount | null> {
  try {
    const extracted = extractPlanFromMarker(assistantText);
    if (!extracted) return null;
    await invokeUpsertPlan({
      sessionId,
      agentId,
      title: extracted.title,
      bodyMd: extracted.bodyMd,
    });
    const refreshed = await invokeListPlansForSession(sessionId);
    set((state) => ({
      sessionPlans: { ...state.sessionPlans, [sessionId]: refreshed },
    }));
    return (
      refreshed.find((p) => p.title === extracted.title && p.bodyMd === extracted.bodyMd) ??
      refreshed[0] ??
      null
    );
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[plan-capture] failed for session ${sessionId}: ${formatError(err)}`);
    }
    return null;
  }
}

async function recordNudgeShown(
  kind: NudgeKind,
  context: Record<string, unknown>,
): Promise<string> {
  const id = crypto.randomUUID();
  const event: NudgeEvent = {
    id,
    ts: new Date().toISOString() as IsoDateTime,
    kind,
    contextJson: JSON.stringify(context),
    outcome: null,
    outcomeTs: null,
  };
  try {
    await insertNudgeEvent(tauriDatabase, event);
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[nudge-event] insert failed: ${formatError(err)}`);
    }
  }
  return id;
}

export async function emitTurnNudges(
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  agentId: AgentId,
  assistantText: string,
  capturedPlan: PlanWithCount | null,
): Promise<void> {
  const session = get().sessions.find((s) => s.id === sessionId);
  if (!session) return;
  const inWorkflow = session.workflowIds.length > 0;

  let nextNudge: SessionNudge | null = null;

  const handoff: ExtractedHandoff | null = extractHandoff(assistantText);
  if (handoff && !inWorkflow) {
    const id = await recordNudgeShown('handoff-suggested', {
      sessionId,
      agentId,
      targetKind: handoff.kind,
      reason: handoff.reason,
      planId: handoff.planId,
    });
    nextNudge = {
      kind: 'handoff-suggested',
      id,
      agentId,
      targetKind: handoff.kind,
      reason: handoff.reason,
      planId: (handoff.planId as PlanId | null) ?? null,
    };
  } else if (capturedPlan && !inWorkflow) {
    const readiness = assessPlanReadiness({
      planBody: capturedPlan.bodyMd,
      assistantText,
    });
    if (readiness.ready) {
      const id = await recordNudgeShown('plan-ready', {
        sessionId,
        agentId,
        planId: capturedPlan.id,
      });
      nextNudge = {
        kind: 'plan-ready',
        id,
        agentId,
        planId: capturedPlan.id,
        planTitle: capturedPlan.title,
      };
    }
  }

  if (nextNudge !== null) {
    set((state) => ({
      sessionNudges: { ...state.sessionNudges, [sessionId]: nextNudge },
    }));
  }
}

export async function applyHeuristicTitle(
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  agentId: AgentId,
  prompt: string,
): Promise<void> {
  try {
    const title = heuristicAgentTitle(prompt);
    if (!title) return;

    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const agentRecord = (get().sessionPhaseRuns[sessionId] ?? []).find((r) => r.id === agentId);
    const agentNameEditable = agentRecord ? /^(agent|puppy) \d+$/i.test(agentRecord.name) : false;

    const titleNow = new Date().toISOString() as IsoDateTime;
    if (!session.titleUserEdited) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, goal: title } : s)),
      }));
      await renameSessionInDb(tauriDatabase, sessionId, title, titleNow, false);
    }
    if (agentNameEditable) {
      await get().renameAgent(sessionId, agentId, title);
    }
  } catch {
    // best-effort
  }
}
