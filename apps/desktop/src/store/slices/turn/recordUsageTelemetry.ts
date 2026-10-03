import { computeProviderCostUsd } from '@goodboy/core';
import {
  insertTelemetry,
  summarizeSessionTelemetry,
  summarizeWorkspaceProviderTelemetry,
  summarizeWorkspaceTelemetry,
} from '@goodboy/db';
import type {
  BudgetAlert,
  IsoDateTime,
  ProviderId,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
  TurnEvent,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeBudgetAlertsList, invokeBudgetEmitAlerts } from '../../../features/budget/budget';
import { buildProviderSpendBreakdown, loadCurrentProviderBudgetStatuses } from '../budget';
import { notifyBudgetAlerts } from './notifyBudgetAlerts';
import type { GetFn, SetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

type Params = {
  event: Extract<TurnEvent, { kind: 'usage' }>;
  provider: ProviderId;
  model: string;
  runId: ProviderRunId;
  sessionId: SessionId;
  now: () => IsoDateTime;
};

export const recordUsageTelemetry = async (
  set: SetFn,
  get: GetFn,
  { event, provider, model, runId, sessionId, now }: Params,
): Promise<void> => {
  const cost = computeProviderCostUsd({
    providerId: provider,
    usage: event.usage,
    model,
  });
  const record: TelemetryRecord = {
    id: crypto.randomUUID() as TelemetryRecordId,
    runId,
    sessionId,
    kind: 'turn',
    provider,
    model,
    inputTokens: event.usage.inputTokens,
    outputTokens: event.usage.outputTokens,
    cachedInputTokens: event.usage.cachedInputTokens,
    cacheCreationInputTokens: event.usage.cacheCreationInputTokens ?? 0,
    ...(event.usage.contextTokens != null && { contextTokens: event.usage.contextTokens }),
    estimatedCostUsd: cost,
    recordedAt: now(),
  };
  await insertTelemetry(tauriDatabase, record);
  set((state) => ({
    sessionTelemetry: {
      ...state.sessionTelemetry,
      [sessionId]: [...(state.sessionTelemetry[sessionId] ?? []), record],
    },
  }));
  const currentSession = sessionById(get().sessions, sessionId);
  if (currentSession != null) {
    const newAlerts: ReadonlyArray<BudgetAlert> = await invokeBudgetEmitAlerts({
      provider,
      sessionId,
    }).catch(() => []);
    const [sessSummary, wsSummary, providerSummaries, providerBudgetStatus, freshAlerts] =
      await Promise.all([
        summarizeSessionTelemetry(tauriDatabase, sessionId),
        summarizeWorkspaceTelemetry(tauriDatabase, currentSession.workspaceId),
        summarizeWorkspaceProviderTelemetry(tauriDatabase, currentSession.workspaceId),
        loadCurrentProviderBudgetStatuses(),
        invokeBudgetAlertsList(),
      ]);
    set({
      sessionSummary: sessSummary,
      workspaceSummary: wsSummary,
      providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries),
      providerBudgetStatus,
      budgetAlerts: freshAlerts,
    });
    notifyBudgetAlerts({ alerts: newAlerts, get });
  }
};
