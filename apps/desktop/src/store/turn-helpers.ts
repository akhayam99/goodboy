import { invoke } from '@tauri-apps/api/core';
import {
  assessPlanReadiness,
  extractClustersFromMarker,
  extractHandoff,
  extractPlanFromMarker,
  SLOT_BUDGETS,
  Summarizer,
  type ExtractedHandoff,
  type SlotKey,
} from '@goodboy/core';
import {
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
  GoalAttachment,
  IsoDateTime,
  MessageAttachment,
  PlanId,
  PlanWithCount,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
  WorkflowRunId,
} from '@goodboy/types';
import { tauriDatabase } from '../shared/lib/db';
import type { AgentKind } from '../features/session/agent-kind';
import { kindReadsAttachment } from '../features/providers/attachment-routing';
import { invokeBudgetRuleList } from '../features/budget/budget';
import {
  listPlansForSession as invokeListPlansForSession,
  upsertPlan as invokeUpsertPlan,
} from '../features/plans/plans';
import { heuristicAgentTitle } from '../shared/lib/agent-title-heuristic';
import { formatError } from '../shared/lib/errors';
import { buildProviderSpendBreakdown } from './slices/budget';
import type { SessionNudge } from './types';
import type { SetFn, GetFn } from './slice-types';

export const buildAttachmentPromptBlock = (refs: ReadonlyArray<MessageAttachment>): string => {
  const list = refs.map((r) => `- ${r.relPath}`).join('\n');
  return [
    '[attached-files]',
    `The user attached ${refs.length} file${refs.length === 1 ? '' : 's'} to this message.`,
    'Inspect each path below before answering. Images and PDFs render with your Read tool; for spreadsheets or other binary formats, read or parse the file with the appropriate tool:',
    list,
    '[/attached-files]',
  ].join('\n');
};

export const buildGoalAttachmentsBlock = (
  kind: AgentKind,
  attachments: ReadonlyArray<GoalAttachment>,
  { isKickoff }: { isKickoff: boolean },
): string => {
  if (!isKickoff) {
    return '';
  }
  const relevant = attachments.filter((att) => kindReadsAttachment(att, kind));
  if (relevant.length === 0) {
    return '';
  }
  const list = relevant.map((a) => `- ${a.relPath}`).join('\n');
  return [
    '## attachments',
    `The user attached ${relevant.length} file${relevant.length === 1 ? '' : 's'} to the goal of this session.`,
    'Read only those relevant to your role; ignore the rest. Inspect each path below with your Read tool before relying on it:',
    list,
  ].join('\n');
};

export const toRelPath = (absPath: string, workingDir: string): string => {
  if (!workingDir) {
    return absPath;
  }
  const root = workingDir.endsWith('/') ? workingDir : `${workingDir}/`;
  return absPath.startsWith(root) ? absPath.slice(root.length) : absPath;
};

type SummarizerQueueEntry = {
  readonly turnInput: string;
  readonly turnOutput: string;
  readonly oversizeRetried: boolean;
};

type SummarizerTaskQueue = {
  inFlight: boolean;
  queued: SummarizerQueueEntry | null;
};

export const summarizerQueues = new Map<SessionId, SummarizerTaskQueue>();

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly entry: SummarizerQueueEntry;
};

function scheduleIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => fn());
  } else {
    queueMicrotask(fn);
  }
}

const runQueuedSummarizer = ({ set, get, sessionId, entry }: Params): void => {
  void runSummarizer({ set, get, sessionId, entry }).finally(() => {
    const queue = summarizerQueues.get(sessionId);
    if (queue == null) {
      return;
    }
    const next = queue.queued;
    if (next == null) {
      queue.inFlight = false;
      return;
    }
    queue.queued = null;
    scheduleIdle(() => {
      runQueuedSummarizer({ set, get, sessionId, entry: next });
    });
  });
};

const reenqueueSummarizer = ({ set, get, sessionId, entry }: Params): void => {
  const queue = summarizerQueues.get(sessionId);
  if (queue?.queued != null) {
    return;
  }
  enqueueSummarizerEntry({ set, get, sessionId, entry });
};

const enqueueSummarizerEntry = ({ set, get, sessionId, entry }: Params): void => {
  let queue = summarizerQueues.get(sessionId);
  if (!queue) {
    queue = { inFlight: false, queued: null };
    summarizerQueues.set(sessionId, queue);
  }

  if (queue.inFlight) {
    queue.queued = entry;
    return;
  }

  queue.inFlight = true;
  queue.queued = null;
  scheduleIdle(() => {
    runQueuedSummarizer({ set, get, sessionId, entry });
  });
};

export const enqueueSummarizer = (
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  turnInput: string,
  turnOutput: string,
): void => {
  enqueueSummarizerEntry({
    set,
    get,
    sessionId,
    entry: { turnInput, turnOutput, oversizeRetried: false },
  });
};

const runSummarizer = async ({ set, get, sessionId, entry }: Params): Promise<void> => {
  const { turnInput, turnOutput } = entry;
  const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

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
    if (!session) {
      return;
    }

    const providerId = session.providerPreference.defaultProvider;
    const summarizer = new Summarizer({ providerId, invokeFn: invoke });
    const prevSlots = get().sessionSlots[sessionId] ?? [];
    const slotValueSnapshot = new Map(prevSlots.map((slot) => [slot.key, slot.value]));
    const ghPr = get().sessionGithub[sessionId]?.pr ?? null;
    const prState = ghPr
      ? {
          hasOpenPr: ghPr.state === 'open' || ghPr.state === 'draft' || ghPr.state === 'approved',
          checksGreen: ghPr.checks === 'success',
        }
      : null;
    const result = await summarizer.summarize({ prevSlots, turnInput, turnOutput, prState });

    const upsertResults = await Promise.all(
      result.delta.upserts.map(async (upsert) => {
        const existing = (get().sessionSlots[sessionId] ?? []).find((s) => s.key === upsert.key);
        if (existing?.value !== slotValueSnapshot.get(upsert.key)) {
          return {
            key: upsert.key,
            value: upsert.value,
            previousValue: null,
            didChange: false,
            hasConflict: true,
          };
        }
        const didChange = existing?.value !== upsert.value;
        const previousValue = existing != null && didChange ? existing.value : null;
        const next: ContextSlot = {
          key: upsert.key,
          value: upsert.value,
          enabled: existing?.enabled ?? true,
        };
        await upsertContextSlot(tauriDatabase, sessionId, next, 'summarizer');
        return {
          key: upsert.key,
          value: upsert.value,
          previousValue,
          didChange,
          hasConflict: false,
        };
      }),
    );
    const changedKeys = upsertResults
      .filter(
        (upsert): upsert is typeof upsert & { previousValue: string } =>
          upsert.previousValue !== null,
      )
      .map((upsert) => upsert.key);
    const hasConflict = upsertResults.some((upsert) => upsert.hasConflict);
    const hasChangedOversizeSlot = upsertResults.some(
      (upsert) =>
        !upsert.hasConflict &&
        upsert.didChange &&
        upsert.value.length > SLOT_BUDGETS[upsert.key] * 2,
    );
    if (hasConflict) {
      reenqueueSummarizer({ set, get, sessionId, entry });
    }
    if (!hasConflict && hasChangedOversizeSlot && !entry.oversizeRetried) {
      reenqueueSummarizer({
        set,
        get,
        sessionId,
        entry: { ...entry, oversizeRetried: true },
      });
    }

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
      providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules),
    }));
    void get().emitNotification('summarizer-success', 'info', 'context summarized', undefined, {
      sessionId,
    });
  } catch (err) {
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
};

export const capturePlanFromTurn = async (
  set: SetFn,
  sessionId: SessionId,
  agentId: AgentId,
  assistantText: string,
  workflowRunId?: WorkflowRunId,
): Promise<PlanWithCount | null> => {
  try {
    const extracted = extractPlanFromMarker(assistantText);
    if (!extracted) {
      return null;
    }
    const clusters = extractClustersFromMarker(assistantText);
    await invokeUpsertPlan({
      sessionId,
      agentId,
      ...(workflowRunId !== undefined && { workflowRunId }),
      title: extracted.title,
      bodyMd: extracted.bodyMd,
      ...(clusters && { clusters }),
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
};

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

export const emitTurnNudges = async (
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  agentId: AgentId,
  assistantText: string,
  capturedPlan: PlanWithCount | null,
): Promise<void> => {
  const session = get().sessions.find((s) => s.id === sessionId);
  if (!session) {
    return;
  }
  const inWorkflow = session.workflowRuns.length > 0;

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
};

export const applyHeuristicTitle = async (
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  agentId: AgentId,
  prompt: string,
): Promise<void> => {
  try {
    const title = heuristicAgentTitle(prompt);
    if (!title) {
      return;
    }

    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) {
      return;
    }

    const agentRecord = (get().sessionPhaseRuns[sessionId] ?? []).find((r) => r.id === agentId);
    const agentNameEditable = agentRecord ? /^(agent|puppy) \d+$/i.test(agentRecord.name) : false;
    const isFoundingAgent = agentRecord?.ordinal === 0;

    const titleNow = new Date().toISOString() as IsoDateTime;
    if (isFoundingAgent && !session.titleUserEdited) {
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
};
