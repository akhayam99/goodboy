import {
  computeCostUsd,
  computeCodexCostUsd,
  computeCursorCostUsd,
  computeGeminiCostUsd,
} from '@goodboy/core'
import {
  insertTelemetry,
  summarizeSessionTelemetry,
  summarizeWorkspaceProviderTelemetry,
  summarizeWorkspaceTelemetry,
} from '@goodboy/db'
import type {
  BudgetAlert,
  IsoDateTime,
  ProviderId,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
  TurnEvent,
} from '@goodboy/types'
import { tauriDatabase } from '../../../shared/lib/db'
import { invokeBudgetAlertsList, invokeBudgetRuleList } from '../../../features/budget/budget'
import {
  getCodexPriceOverride,
  getGeminiPriceOverride,
} from '../../../features/providers/provider-pricing'
import { buildProviderSpendBreakdown } from '../budget'
import type { GetFn, SetFn } from './types'

type Params = {
  event: Extract<TurnEvent, { kind: 'usage' }>
  provider: ProviderId
  model: string
  runId: ProviderRunId
  sessionId: SessionId
  now: () => IsoDateTime
  onNewAlerts?: (alerts: ReadonlyArray<BudgetAlert>) => void
}

export const recordUsageTelemetry = async (
  set: SetFn,
  get: GetFn,
  { event, provider, model, runId, sessionId, now, onNewAlerts }: Params,
): Promise<void> => {
  const cost = (() => {
    if (provider === 'codex') {
      return computeCodexCostUsd(event.usage, model, getCodexPriceOverride(null, model))
    }
    if (provider === 'cursor') {
      return computeCursorCostUsd(event.usage, model)
    }
    if (provider === 'gemini') {
      return computeGeminiCostUsd(event.usage, model, getGeminiPriceOverride(null, model))
    }
    return computeCostUsd(event.usage, model)
  })()
  const record: TelemetryRecord = {
    id: crypto.randomUUID() as TelemetryRecordId,
    runId,
    sessionId,
    kind: 'turn',
    provider,
    model,
    inputTokens: event.usage.inputTokens,
    outputTokens: event.usage.outputTokens,
    estimatedCostUsd: cost,
    recordedAt: now(),
  }
  await insertTelemetry(tauriDatabase, record)
  set((state) => ({
    sessionTelemetry: {
      ...state.sessionTelemetry,
      [sessionId]: [...(state.sessionTelemetry[sessionId] ?? []), record],
    },
  }))
  const currentSession = get().sessions.find((s) => s.id === sessionId)
  if (currentSession) {
    const [sessSummary, wsSummary, providerSummaries, budgetRules, freshAlerts] = await Promise.all(
      [
        summarizeSessionTelemetry(tauriDatabase, sessionId),
        summarizeWorkspaceTelemetry(tauriDatabase, currentSession.workspaceId),
        summarizeWorkspaceProviderTelemetry(tauriDatabase, currentSession.workspaceId),
        invokeBudgetRuleList(),
        invokeBudgetAlertsList(),
      ],
    )
    const knownIds = new Set(get().budgetAlerts.map((a) => a.id))
    const newAlerts = freshAlerts.filter((a) => !knownIds.has(a.id))
    set({
      sessionSummary: sessSummary,
      workspaceSummary: wsSummary,
      providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules),
      budgetAlerts: freshAlerts,
    })
    if (newAlerts.length > 0 && onNewAlerts) {
      onNewAlerts(newAlerts)
    }
  }
}
