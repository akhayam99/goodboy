import { invoke } from '@tauri-apps/api/core';
import { formatError } from '@goodboy/ui';
import {
  assessPlanReadiness,
  captureArtifactFromTurnText,
  extractHandoff,
  extractMaterializeRequests,
  extractScoutDomains,
  hasBlockingQuestion,
  planTaskModelFallback,
  resolveTaskModel,
  SLOT_BUDGETS,
  Summarizer,
  SummarizerParseError,
  type ArtifactCaptureError,
  type ExtractedHandoff,
  type ParsedArtifact,
  type SlotKey,
} from '@goodboy/core';
import {
  insertNudgeEvent,
  insertProviderRun,
  insertTelemetry,
  countContextSlotHistoryForSession,
  listContextSlotHistory,
  listContextSlotsForSession,
  listTelemetryForSession,
  summarizeSessionTelemetry,
  summarizeWorkspaceProviderTelemetry,
  summarizeWorkspaceTelemetry,
  updateProviderRunStatus,
  updateAgentDomains,
  upsertContextSlot,
  type NudgeEvent,
  type NudgeKind,
} from '@goodboy/db';
import type {
  AgentId,
  ContextSlot,
  SessionArtifact,
  GoalAttachment,
  IsoDateTime,
  MessageAttachment,
  MountId,
  PlanId,
  PlanWithCount,
  ProviderId,
  ProviderRunId,
  SessionId,
  TaskModelPreference,
  TelemetryRecord,
  TelemetryRecordId,
  WireframeArtifactMetadata,
  WorkflowRunId,
} from '@goodboy/types';
import { tauriDatabase } from '../shared/lib/db';
import {
  appendArtifactProvenanceOmission,
  completeArtifactRun,
  loadArtifactProvenance,
} from '../features/artifacts/artifactProvenance';
import { recordArtifactAssumptions } from '../features/artifacts/recordArtifactAssumptions';
import { reviseArtifactForAgent } from '../features/artifacts/reviseArtifactForAgent';
import { capturedWireframeFidelity } from '../features/wireframes/capturedWireframeFidelity';
import { requestedWireframeFidelity } from '../features/wireframes/wireframeFidelity';
import type { AgentKind } from '../features/session/agent-kind';
import { kindReadsAttachment } from '../features/providers/attachment-routing';
import { classifyProviderError } from '../features/chat/classifyProviderError';
import {
  cooldownWindowEnd,
  providersCoolingDown,
  routeTaskModel,
  withFailureCooldown,
} from '../features/providers/taskModelRouting';
import { invokeBudgetRuleList } from '../features/budget/budget';
import {
  listPlansForSession as invokeListPlansForSession,
  upsertPlan as invokeUpsertPlan,
} from '../features/plans/plans';
import {
  createArtifact as invokeCreateArtifact,
  listArtifactsForSession as invokeListArtifactsForSession,
} from '../features/artifacts/artifacts';
import { buildProviderSpendBreakdown } from './slices/budget';
import type { SessionNudge } from './types';
import type { SetFn, GetFn } from './slice-types';
import { decisionsDelta } from './slices/session-events';
import {
  deferredMaterializeNote,
  materializationGate,
  proposeMaterialization,
  runMaterializationBatch,
} from './materializationGate';
import { sessionAwaitsPullRequest } from './slices/github/sessionAwaitsPullRequest';
import { selectMountById } from './slices/project-mounts/selectors';
import { mountContinuationRefusal, queueMountContinuation } from './slices/turn/mountContinuations';
import { selectResolvedSettings } from './slices/overrides/selectResolvedSettings';

type AttachmentsBlockParams = {
  readonly scope: string;
  readonly paths: ReadonlyArray<string>;
};

const composeAttachmentsBlock = ({ scope, paths }: AttachmentsBlockParams): string =>
  `**Attached** (${scope}) read each path with your Read tool before relying on it:\n${paths
    .map((path) => `- ${path}`)
    .join('\n')}`;

export const buildAttachmentPromptBlock = (refs: ReadonlyArray<MessageAttachment>): string =>
  composeAttachmentsBlock({
    scope: 'this message',
    paths: refs.map((ref) => ref.relPath),
  });

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
  return composeAttachmentsBlock({
    scope: 'session goal, read only what your role needs',
    paths: relevant.map((att) => att.relPath),
  });
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
  readonly workingDir: string | null;
  readonly oversizeRetried: boolean;
  readonly parseRetried?: boolean;
  readonly providerAttempt?: number;
  readonly taskModelOverride?: TaskModelPreference;
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

type MergeTelemetryParams = {
  readonly refreshed: ReadonlyArray<TelemetryRecord>;
  readonly current: ReadonlyArray<TelemetryRecord>;
};

const mergeTelemetry = ({
  refreshed,
  current,
}: MergeTelemetryParams): ReadonlyArray<TelemetryRecord> => {
  const recordsById = new Map(refreshed.map((record) => [record.id, record]));
  for (const record of current) {
    if (recordsById.has(record.id)) {
      continue;
    }
    recordsById.set(record.id, record);
  }
  return [...recordsById.values()];
};

const scheduleIdle = ({ run }: { readonly run: () => void }): void => {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => run());
    return;
  }
  queueMicrotask(run);
};

const runQueuedSummarizer = ({ set, get, sessionId, entry }: Params): void => {
  void runSummarizer({ set, get, sessionId, entry }).finally(() => {
    const queue = summarizerQueues.get(sessionId);
    if (queue == null) {
      return;
    }
    const next = queue.queued;
    if (next == null) {
      summarizerQueues.delete(sessionId);
      void get().maybeAutoAdvanceWorkflow(sessionId);
      return;
    }
    queue.queued = null;
    scheduleIdle({ run: () => runQueuedSummarizer({ set, get, sessionId, entry: next }) });
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
  scheduleIdle({ run: () => runQueuedSummarizer({ set, get, sessionId, entry }) });
};

type EnqueueParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly turnInput: string;
  readonly turnOutput: string;
  readonly workingDir: string | null;
  readonly taskModelOverride?: TaskModelPreference;
};

export const enqueueSummarizer = ({
  set,
  get,
  sessionId,
  turnInput,
  turnOutput,
  workingDir,
  taskModelOverride,
}: EnqueueParams): void => {
  enqueueSummarizerEntry({
    set,
    get,
    sessionId,
    entry: {
      turnInput,
      turnOutput,
      workingDir,
      oversizeRetried: false,
      ...(taskModelOverride && { taskModelOverride }),
    },
  });
};

const runSummarizer = async ({ set, get, sessionId, entry }: Params): Promise<void> => {
  const { turnInput, turnOutput, workingDir } = entry;
  const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

  const session = get().sessions.find((s) => s.id === sessionId);
  if (!session) {
    return;
  }
  const connectedProviders = get()
    .providers.filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id);
  const enabledProviders = session.providerPreference.enabledProviders ?? null;
  const taskModel =
    entry.taskModelOverride ??
    routeTaskModel({
      taskModel: resolveTaskModel({
        task: 'summarizer',
        preferences: selectResolvedSettings({ state: get(), sessionId })?.taskModels,
        workspaceDefaultProviderId: selectResolvedSettings({ state: get(), sessionId })
          ?.defaultProviderOverride,
        sessionDefaultProviderId: session.providerPreference.defaultProvider,
      }),
      connectedProviders,
      enabledProviders,
      cooldowns: get().providerCooldowns,
      nowMs: Date.now(),
    });

  if (taskModel === null) {
    const windowEnd = cooldownWindowEnd({ cooldowns: get().providerCooldowns, nowMs: Date.now() });
    set((state) => {
      const prev = state.summarizerStatus[sessionId];
      return {
        summarizerStatus: {
          ...state.summarizerStatus,
          [sessionId]: {
            status: 'error',
            lastUpdate: now(),
            error: 'every summarizer provider is cooling down',
            lastUsage: prev?.lastUsage ?? null,
            lastAttempt: { turnInput, turnOutput, workingDir },
          },
        },
      };
    });
    void get().emitNotification({
      kind: 'error',
      severity: 'error',
      title: 'summarizer paused',
      body: 'every summarizer provider is cooling down',
      sessionId,
      action: { kind: 'retry-summarizer', sessionId },
      coalesceKey: `summarizer-cooling:${sessionId}:${windowEnd ?? 'unknown'}`,
    });
    return;
  }

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
          lastAttempt: { turnInput, turnOutput, workingDir },
        },
      },
    };
  });

  try {
    const summarizer = new Summarizer({
      providerId: taskModel.providerId,
      model: taskModel.model,
      ...(taskModel.effort != null && { effort: taskModel.effort }),
      invokeFn: invoke,
      ...(workingDir !== null && { workingDir }),
    });
    const prevSlots = get().sessionSlots[sessionId] ?? [];
    const slotValueSnapshot = new Map(prevSlots.map((slot) => [slot.key, slot.value]));
    const result = await summarizer.summarize({ prevSlots, turnInput, turnOutput });

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
    const decisionsUpsert = upsertResults.find(
      (upsert) => upsert.key === 'decisions' && upsert.didChange && !upsert.hasConflict,
    );
    if (decisionsUpsert != null) {
      const delta = decisionsDelta({
        previous: decisionsUpsert.previousValue ?? '',
        next: decisionsUpsert.value,
      });
      if (delta.added > 0 || delta.removed > 0) {
        await get().recordSessionEvent({
          sessionId,
          kind: 'decisions_changed',
          payload: { added: delta.added, removed: delta.removed },
        });
      }
    }
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
      sessionAwaitsPullRequest({ state: get(), sessionId }) &&
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
      slotHistoryCounts,
      openHistory,
    ] = await Promise.all([
      listContextSlotsForSession(tauriDatabase, sessionId),
      insertProviderRun(tauriDatabase, {
        id: summarizerRunId,
        sessionId,
        provider: taskModel.providerId,
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
            provider: taskModel.providerId,
            model: result.model,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            cachedInputTokens: result.usage.cachedInputTokens,
            cacheCreationInputTokens: result.usage.cacheCreationInputTokens,
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
      countContextSlotHistoryForSession(tauriDatabase, sessionId),
      Promise.all(
        changedKeys
          .filter((key) => get().slotHistory[sessionId]?.[key] !== undefined)
          .map(
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
          ...Object.fromEntries(openHistory),
        },
      },
      slotHistoryCounts: { ...state.slotHistoryCounts, [sessionId]: slotHistoryCounts },
      sessionSummary,
      workspaceSummary,
      sessionTelemetry: {
        ...state.sessionTelemetry,
        [sessionId]: mergeTelemetry({
          refreshed: telemetry,
          current: state.sessionTelemetry[sessionId] ?? [],
        }),
      },
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
  } catch (err) {
    const message = formatError(err);
    if (import.meta.env.DEV) {
      console.warn(`[summarizer] failed for session ${sessionId}: ${message}`);
    }
    const willRetryParse = err instanceof SummarizerParseError && entry.parseRetried !== true;
    const failure = willRetryParse ? null : classifyProviderError({ message });
    if (
      failure !== null &&
      (failure.kind === 'usage_limit' ||
        failure.kind === 'authentication' ||
        failure.kind === 'rate_limit')
    ) {
      set((state) => ({
        providerCooldowns: withFailureCooldown({
          cooldowns: state.providerCooldowns,
          provider: taskModel.providerId,
          failure,
          nowMs: Date.now(),
        }),
      }));
    }
    const providerAttempt = entry.providerAttempt ?? 0;
    const providerFallback =
      failure === null
        ? null
        : planTaskModelFallback({
            failure: failure.kind,
            taskModel,
            attempt: providerAttempt,
            connectedProviders,
            enabledProviders,
            coolingDownProviders: providersCoolingDown({
              cooldowns: get().providerCooldowns,
              nowMs: Date.now(),
            }),
          });
    const willRetry = willRetryParse || providerFallback !== null;
    set((state) => {
      const prev = state.summarizerStatus[sessionId];
      return {
        summarizerStatus: {
          ...state.summarizerStatus,
          [sessionId]: {
            status: willRetry ? 'running' : 'error',
            lastUpdate: now(),
            error: willRetry ? null : message,
            lastUsage: prev?.lastUsage ?? null,
            lastAttempt: prev?.lastAttempt ?? { turnInput, turnOutput, workingDir },
          },
        },
      };
    });
    if (willRetryParse) {
      reenqueueSummarizer({ set, get, sessionId, entry: { ...entry, parseRetried: true } });
      return;
    }
    if (providerFallback !== null) {
      reenqueueSummarizer({
        set,
        get,
        sessionId,
        entry: {
          ...entry,
          providerAttempt: providerAttempt + 1,
          taskModelOverride: providerFallback,
        },
      });
      return;
    }
    void get().emitNotification({
      kind: 'error',
      severity: 'error',
      title: 'summarizer failed',
      body: `${taskModel.providerId}: ${message}`,
      sessionId,
      action: { kind: 'retry-summarizer', sessionId },
      coalesceKey: `summarizer-failed:${sessionId}`,
    });
  }
};

type CaptureArtifactsParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly agentName?: string | null;
  readonly assistantText: string;
  readonly emittingProvider: ProviderId | null;
  readonly sourceTurnId: string;
  readonly workflowRunId?: WorkflowRunId | undefined;
};

export type CapturedArtifacts = {
  readonly plan: PlanWithCount | null;
  readonly artifact: SessionArtifact | null;
  readonly error: ArtifactCaptureError | null;
};

const NOTHING_CAPTURED: CapturedArtifacts = { plan: null, artifact: null, error: null };

type OverrideFidelityParams = {
  readonly agentId: AgentId;
  readonly agentName: string | null;
  readonly parsed: Extract<ParsedArtifact, { readonly kind: 'wireframe' }>;
};

const overrideWireframeFidelity = async ({
  agentId,
  agentName,
  parsed,
}: OverrideFidelityParams): Promise<WireframeArtifactMetadata> => {
  const provenance = await loadArtifactProvenance(agentId).catch(() => null);
  const decision = capturedWireframeFidelity({
    requested: requestedWireframeFidelity({ agentName }),
    hasDesignSource: provenance?.hasDesignEvidence === true,
  });
  if (decision.note !== null) {
    await appendArtifactProvenanceOmission({ agentId, note: decision.note }).catch(() => undefined);
  }
  return { ...parsed.metadata, fidelity: decision.fidelity };
};

export const captureArtifactsFromTurn = async ({
  set,
  sessionId,
  agentId,
  agentName = null,
  assistantText,
  emittingProvider,
  sourceTurnId,
  workflowRunId,
}: CaptureArtifactsParams): Promise<CapturedArtifacts> => {
  if (hasBlockingQuestion({ assistantText })) {
    return NOTHING_CAPTURED;
  }
  await recordArtifactAssumptions({ agentId, assistantText });
  const captured = captureArtifactFromTurnText({ assistantText, emittingProvider });
  if (captured.status === 'none') {
    return NOTHING_CAPTURED;
  }
  if (captured.status === 'error') {
    return { plan: null, artifact: null, error: captured };
  }
  const parsed = captured.artifact;
  try {
    if (parsed.kind === 'plan') {
      await invokeUpsertPlan({
        sessionId,
        agentId,
        ...(workflowRunId !== undefined && { workflowRunId }),
        title: parsed.title,
        bodyMd: parsed.sourceText,
        ...(parsed.metadata.clusters && { clusters: parsed.metadata.clusters }),
        sourceTurnId,
      });
      const refreshed = await invokeListPlansForSession(sessionId);
      const refreshedArtifacts = await invokeListArtifactsForSession(sessionId).catch(
        (err: unknown) => {
          if (import.meta.env.DEV) {
            console.warn(
              `[artifact-capture] artifact refresh failed for session ${sessionId}: ${formatError(err)}`,
            );
          }
          return null;
        },
      );
      set((state) => ({
        sessionPlans: { ...state.sessionPlans, [sessionId]: refreshed },
        ...(refreshedArtifacts === null
          ? {}
          : { sessionArtifacts: { ...state.sessionArtifacts, [sessionId]: refreshedArtifacts } }),
      }));
      const plan =
        refreshed.find((p) => p.title === parsed.title && p.bodyMd === parsed.sourceText) ??
        refreshed[0] ??
        null;
      return { plan, artifact: null, error: null };
    }
    const metadata =
      parsed.kind === 'wireframe'
        ? await overrideWireframeFidelity({ agentId, agentName, parsed })
        : parsed.metadata;
    const revised = await reviseArtifactForAgent({
      sessionId,
      agentId,
      kind: parsed.kind,
      title: parsed.title,
      sourceFormat: parsed.sourceFormat,
      sourceText: parsed.sourceText,
      metadata,
      sourceTurnId,
    });
    const artifact =
      revised ??
      (await invokeCreateArtifact({
        sessionId,
        agentId,
        workflowRunId: workflowRunId ?? null,
        kind: parsed.kind,
        schemaVersion: parsed.schemaVersion,
        title: parsed.title,
        sourceFormat: parsed.sourceFormat,
        sourceText: parsed.sourceText,
        metadata,
        sourceTurnId,
      }));
    await completeArtifactRun({ agentId }).catch(() => undefined);
    const refreshed = await invokeListArtifactsForSession(sessionId);
    set((state) => ({
      sessionArtifacts: { ...state.sessionArtifacts, [sessionId]: refreshed },
    }));
    return { plan: null, artifact, error: null };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[artifact-capture] failed for session ${sessionId}: ${formatError(err)}`);
    }
    return {
      plan: null,
      artifact: null,
      error: {
        status: 'error',
        code: 'invalid_payload',
        message: formatError(err),
      },
    };
  }
};

type CaptureScoutDomainsParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly agentKind: AgentKind;
  readonly assistantText: string;
};

export const captureScoutDomainsFromTurn = async ({
  set,
  sessionId,
  agentId,
  agentKind,
  assistantText,
}: CaptureScoutDomainsParams): Promise<ReadonlyArray<string> | null> => {
  if (agentKind !== 'scout') {
    return null;
  }
  const domains = extractScoutDomains(assistantText);
  if (domains === null) {
    return null;
  }
  try {
    await updateAgentDomains({ db: tauriDatabase, id: agentId, domains });
    set((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) =>
          agent.id === agentId ? { ...agent, domains } : agent,
        ),
      },
    }));
    return domains;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[scout-domains] failed for agent ${agentId}: ${formatError(err)}`);
    }
    return null;
  }
};

type CaptureMaterializeParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly assistantText: string;
  readonly boundMountId: MountId | null;
};

export const captureMaterializeRequestsFromTurn = async ({
  get,
  sessionId,
  agentId,
  runId,
  assistantText,
  boundMountId,
}: CaptureMaterializeParams): Promise<void> => {
  const requests = extractMaterializeRequests(assistantText);
  if (requests.length === 0) {
    return;
  }
  const session = get().sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    return;
  }
  const projects = get().projects.filter((project) => project.workspaceId === session.workspaceId);
  const note = (message: string) => {
    get().appendTurnEvent(agentId, sessionId, {
      kind: 'error',
      runId,
      message,
      at: new Date().toISOString() as IsoDateTime,
    });
  };
  const decisionNote = (message: string) => {
    get().appendTurnEvent(agentId, sessionId, {
      kind: 'decision_note',
      runId,
      message,
      at: new Date().toISOString() as IsoDateTime,
    });
  };
  await runMaterializationBatch({
    sessionId,
    batchId: runId,
    run: async ({ budget }) => {
      for (const [requestIndex, request] of requests.entries()) {
        const project = projects.find(
          (candidate) => candidate.name.toLowerCase() === request.projectName.toLowerCase(),
        );
        if (project === undefined) {
          await get().recordSessionEvent({
            sessionId,
            kind: 'project_materialization_refused',
            payload: {
              projectName: request.projectName,
              reason: `no project named "${request.projectName}" in this workspace`,
            },
          });
          const known = projects.map((candidate) => candidate.name).join(', ');
          note(
            `materialize refused: no project named "${request.projectName}" in this workspace.${known.length > 0 ? ` Known projects: ${known}.` : ''}`,
          );
          continue;
        }
        const decision = materializationGate({
          get,
          sessionId,
          project,
          immediateProjectIds: budget.immediateProjectIds,
        });
        if (decision.kind === 'deferred') {
          try {
            const proposal = await proposeMaterialization({
              get,
              sessionId,
              project,
              reason: request.reason,
              cause: decision.cause,
              agentId,
              turnRunId: runId,
            });
            decisionNote(
              deferredMaterializeNote({
                projectName: project.name,
                isAlreadyPending: proposal === 'already-pending',
              }),
            );
          } catch (error) {
            note(`materialize failed for ${project.name}: ${formatError(error)}`);
          }
          continue;
        }
        try {
          const outcome = await get().ensureProjectMounted({
            sessionId,
            projectId: project.id,
            reason: request.reason,
          });
          if (outcome.status !== 'created') {
            continue;
          }
          budget.immediateProjectIds.add(project.id);
          const mount = selectMountById({
            state: get(),
            sessionId,
            mountId: outcome.createdMountId,
          });
          if (mount === null) {
            note(`materialize failed for ${project.name}: the created mount is not available`);
            continue;
          }
          const continuation = queueMountContinuation({
            continuation: {
              operationId: `materialize:${runId}:${project.id}:${requestIndex}`,
              sessionId,
              mountId: mount.mountId,
              mountName: mount.mountName,
              branch: mount.branch,
              worktreePath: mount.worktreePath,
              origin: 'materialize',
            },
            boundMountId,
          });
          if (!continuation.queued) {
            decisionNote(mountContinuationRefusal({ refusal: continuation.refusal }));
          }
        } catch (error) {
          note(`materialize failed for ${project.name}: ${formatError(error)}`);
        }
      }
    },
  });
};

type RecordNudgeShownParams = {
  readonly kind: NudgeKind;
  readonly sessionId: SessionId;
  readonly context: Record<string, unknown>;
};

const recordNudgeShown = async ({
  kind,
  sessionId,
  context,
}: RecordNudgeShownParams): Promise<string> => {
  const id = crypto.randomUUID();
  const event = {
    id,
    sessionId,
    ts: new Date().toISOString() as IsoDateTime,
    kind,
    contextJson: JSON.stringify(context),
    outcome: null,
    outcomeTs: null,
  } satisfies NudgeEvent;
  try {
    await insertNudgeEvent(tauriDatabase, event);
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[nudge-event] insert failed: ${formatError(err)}`);
    }
  }
  return id;
};

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
    const id = await recordNudgeShown({
      kind: 'handoff-suggested',
      sessionId,
      context: {
        sessionId,
        agentId,
        targetKind: handoff.kind,
        reason: handoff.reason,
        planId: handoff.planId,
      },
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
      const id = await recordNudgeShown({
        kind: 'plan-ready',
        sessionId,
        context: {
          sessionId,
          agentId,
          planId: capturedPlan.id,
        },
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
