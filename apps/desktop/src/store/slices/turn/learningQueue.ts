import { LearningExtractor } from '@goodboy/core';
import {
  insertProviderRun,
  insertSessionContextItems,
  insertTelemetry,
  updateProviderRunStatus,
} from '@goodboy/db';
import type {
  AgentId,
  AgentRole,
  IsoDateTime,
  ProviderRunId,
  SessionContextItemDraft,
  SessionContextItemId,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
} from '@goodboy/types';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { tauriDatabase } from '../../../shared/lib/db';
import { isLearningsOn } from '../../../features/context/contextSwitches';
import { routeTaskModel } from '../../../features/providers/taskModelRouting';
import { autoLimitContext } from '../providerLimits/autoLimitContext';
import { resolveLimitedTaskModel } from '../providerLimits/resolveLimitedTaskModel';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import { sessionById } from '../sessions/sessionIndex';
import { selectHiddenModels } from '../settings/selectHiddenModels';
import { scheduleIdle } from './turnHelpers';
import { autoRoutableProviders } from '../../../features/providers/autoRoutableProviders';
import type { GetFn, SetFn } from './types';

type LearningEntry = Readonly<{
  role: AgentRole;
  turnOrdinal: number;
  topics: ReadonlyArray<string>;
  turnInput: string;
  turnOutput: string;
  workingDir: string | null;
}>;

type Queue = {
  isRunning: boolean;
  entries: ReadonlyArray<LearningEntry>;
};

export const learningQueues = new Map<AgentId, Queue>();

const MAX_MERGED_CHARS = 20_000;

type MergedEntries = Readonly<{
  latest: LearningEntry;
  turnStart: number;
  turnInput: string;
  turnOutput: string;
}>;

const mergeLearningEntries = (
  entries: readonly [LearningEntry, ...ReadonlyArray<LearningEntry>],
): MergedEntries => {
  const kept = entries.reduceRight<ReadonlyArray<LearningEntry>>((acc, entry) => {
    const used = acc.reduce((sum, item) => sum + item.turnInput.length + item.turnOutput.length, 0);
    const size = entry.turnInput.length + entry.turnOutput.length;
    return acc.length > 0 && used + size > MAX_MERGED_CHARS ? acc : [entry, ...acc];
  }, []);
  const latest = entries[entries.length - 1] ?? entries[0];
  const first = kept[0] ?? latest;
  const label = ({ entry }: { readonly entry: LearningEntry }) => `Turn ${entry.turnOrdinal}:\n`;
  return {
    latest,
    turnStart: first.turnOrdinal,
    turnInput: kept.map((entry) => `${label({ entry })}${entry.turnInput}`).join('\n\n---\n\n'),
    turnOutput: kept.map((entry) => `${label({ entry })}${entry.turnOutput}`).join('\n\n---\n\n'),
  };
};

type RunParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly entries: readonly [LearningEntry, ...ReadonlyArray<LearningEntry>];
};

const nowIso = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

const runLearnings = async ({ set, get, sessionId, agentId, entries }: RunParams) => {
  const session = sessionById(get().sessions, sessionId);
  if (session === undefined) {
    return;
  }
  const settings = selectResolvedSettings({ state: get(), sessionId });
  const taskModel = routeTaskModel({
    taskModel: resolveLimitedTaskModel({
      limitContext: autoLimitContext({ state: get() }),
      task: 'learnings',
      preferences: settings?.taskModels,
      workspaceDefaultProviderId: settings?.defaultProviderOverride,
      sessionDefaultProviderId: session.providerPreference.defaultProvider,
    }),
    connectedProviders: autoRoutableProviders({ providers: get().providers }),
    enabledProviders: session.providerPreference.enabledProviders ?? null,
    cooldowns: get().providerCooldowns,
    hidden: selectHiddenModels({ state: get() }),
    nowMs: Date.now(),
  });
  if (taskModel === null) {
    return;
  }
  const merged = mergeLearningEntries(entries);
  const extractor = new LearningExtractor({
    providerId: taskModel.providerId,
    model: taskModel.model,
    ...(taskModel.effort != null && { effort: taskModel.effort }),
    ...(merged.latest.workingDir !== null && { workingDir: merged.latest.workingDir }),
    invokeFn: invokeCommand,
  });
  const startedAt = nowIso();
  const result = await extractor.extract({
    topics: merged.latest.topics,
    turnInput: merged.turnInput,
    turnOutput: merged.turnOutput,
  });
  const runId = crypto.randomUUID() as ProviderRunId;
  await insertProviderRun(tauriDatabase, {
    id: runId,
    sessionId,
    provider: taskModel.providerId,
    model: result.model,
    status: { kind: 'streaming', startedAt },
    createdAt: startedAt,
  });
  const finishedAt = nowIso();
  await updateProviderRunStatus(tauriDatabase, runId, { kind: 'succeeded', finishedAt });
  const telemetry: TelemetryRecord = {
    id: crypto.randomUUID() as TelemetryRecordId,
    runId,
    sessionId,
    kind: 'summarizer',
    provider: taskModel.providerId,
    model: result.model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cachedInputTokens: result.usage.cachedInputTokens,
    cacheCreationInputTokens: result.usage.cacheCreationInputTokens,
    estimatedCostUsd: result.usage.estimatedCostUsd,
    recordedAt: finishedAt,
  };
  await insertTelemetry(tauriDatabase, telemetry);
  set((state) => ({
    sessionTelemetry: {
      ...state.sessionTelemetry,
      [sessionId]: [...(state.sessionTelemetry[sessionId] ?? []), telemetry],
    },
  }));
  const items: ReadonlyArray<SessionContextItemDraft> = result.items.map((item) => ({
    id: crypto.randomUUID() as SessionContextItemId,
    sessionId,
    workspaceId: session.workspaceId,
    kind: 'learning',
    title: item.title,
    text: item.text,
    topic: item.topic,
    source: {
      role: merged.latest.role,
      agentId,
      turnStart: merged.turnStart,
      turnEnd: merged.latest.turnOrdinal,
    },
    audience: [],
    status: 'active',
    createdAt: finishedAt,
  }));
  if (items.length === 0) {
    return;
  }
  await insertSessionContextItems({ db: tauriDatabase, items });
  await get().refreshContextItems({ sessionId, workspaceId: session.workspaceId });
};

type DrainParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const drain = ({ set, get, sessionId, agentId }: DrainParams): void => {
  const queue = learningQueues.get(agentId);
  const [first, ...rest] = queue?.entries ?? [];
  if (queue === undefined || first === undefined) {
    learningQueues.delete(agentId);
    return;
  }
  queue.entries = [];
  queue.isRunning = true;
  void runLearnings({ set, get, sessionId, agentId, entries: [first, ...rest] })
    .catch(() => undefined)
    .finally(() => {
      queue.isRunning = false;
      if (queue.entries.length === 0) {
        learningQueues.delete(agentId);
        return;
      }
      scheduleIdle({ run: () => drain({ set, get, sessionId, agentId }) });
    });
};

type EnqueueParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly entry: LearningEntry;
};

export const enqueueLearnings = ({ set, get, sessionId, agentId, entry }: EnqueueParams): void => {
  if (entry.topics.length === 0 || !isLearningsOn({ settings: get().settings })) {
    return;
  }
  const queue = learningQueues.get(agentId) ?? { isRunning: false, entries: [] };
  queue.entries = [...queue.entries, entry];
  learningQueues.set(agentId, queue);
  if (queue.isRunning || queue.entries.length > 1) {
    return;
  }
  scheduleIdle({ run: () => drain({ set, get, sessionId, agentId }) });
};
