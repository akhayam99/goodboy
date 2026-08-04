import type { OrchestratorUsage } from '@goodboy/core';
import {
  insertProviderRun,
  insertTelemetry,
  summarizeSessionTelemetry,
  summarizeWorkspaceTelemetry,
  updateProviderRunStatus,
} from '@goodboy/db';
import type {
  AgentId,
  IsoDateTime,
  ProviderId,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly provider: ProviderId;
  readonly model: string;
  readonly usage: OrchestratorUsage;
};

type HistoryParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const knownRunIds = ({ get, sessionId, agentId }: HistoryParams): ReadonlyArray<ProviderRunId> => {
  const tracked = get().agentRunHistory[agentId] ?? [];
  if (tracked.length > 0) {
    return tracked;
  }
  const row = (get().sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => candidate.id === agentId,
  );
  return row?.runId != null ? [row.runId] : [];
};

export const recordOrchestratorUsage = async ({
  set,
  get,
  sessionId,
  agentId,
  provider,
  model,
  usage,
}: Params): Promise<void> => {
  if (agentId == null || usage.inputTokens + usage.outputTokens === 0) {
    return;
  }
  const runId = crypto.randomUUID() as ProviderRunId;
  const startedAt = new Date().toISOString() as IsoDateTime;
  await insertProviderRun(tauriDatabase, {
    id: runId,
    sessionId,
    provider,
    model,
    status: { kind: 'streaming', startedAt },
    createdAt: startedAt,
  });
  const finishedAt = new Date().toISOString() as IsoDateTime;
  await updateProviderRunStatus(tauriDatabase, runId, { kind: 'succeeded', finishedAt });
  const record: TelemetryRecord = {
    id: crypto.randomUUID() as TelemetryRecordId,
    runId,
    sessionId,
    kind: 'turn',
    provider,
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens,
    estimatedCostUsd: usage.estimatedCostUsd,
    recordedAt: finishedAt,
  };
  await insertTelemetry(tauriDatabase, record);
  const history = [...knownRunIds({ get, sessionId, agentId }), runId];
  set((state) => ({
    sessionTelemetry: {
      ...state.sessionTelemetry,
      [sessionId]: [...(state.sessionTelemetry[sessionId] ?? []), record],
    },
    agentRunHistory: { ...state.agentRunHistory, [agentId]: history },
  }));
  const session = get().sessions.find((candidate) => candidate.id === sessionId);
  if (session == null) {
    return;
  }
  const [sessionSummary, workspaceSummary] = await Promise.all([
    summarizeSessionTelemetry(tauriDatabase, sessionId),
    summarizeWorkspaceTelemetry(tauriDatabase, session.workspaceId),
  ]);
  set({ sessionSummary, workspaceSummary });
};
