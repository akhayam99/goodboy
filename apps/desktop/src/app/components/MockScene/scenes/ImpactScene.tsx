import { useEffect, useState } from 'react';
import type {
  BudgetAlert,
  BudgetRule,
  IsoDateTime,
  ProviderId,
  ProviderName,
  ProviderRunId,
  Session,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
  WorkspaceId,
} from '@goodboy/types';
import { ImpactStudio } from '../../../../features/impact/components/ImpactStudio';
import { StudioFrame } from './StudioFrame';
import { mockWorkspace, seedStudioChrome } from './shellChrome';
import { useAppStore, type ProviderSpendEntry } from '../../../../store';

const WORKSPACE_ID = 'mock-impact-workspace-northwind' as WorkspaceId;
const WORKSPACE_NAME = 'Northwind';

const NOW = Date.now();

const iso = (daysAgo: number, hour = 10): IsoDateTime =>
  new Date(NOW - daysAgo * 86_400_000 + hour * 3_600_000).toISOString() as IsoDateTime;

const PAYMENTS_ID = 'mock-impact-session-payments-rounding' as SessionId;
const NOTIFY_ID = 'mock-impact-session-notify-ratelimit' as SessionId;
const BILLING_ID = 'mock-impact-session-billing-export' as SessionId;
const STOREFRONT_ID = 'mock-impact-session-storefront-checkout' as SessionId;
const WEBCONSOLE_ID = 'mock-impact-session-webconsole-audit' as SessionId;

const buildSession = (id: SessionId, goal: string, defaultProvider: ProviderId): Session => ({
  id,
  workspaceId: WORKSPACE_ID,
  goal,
  state: { kind: 'idle', lastActivityAt: iso(0) },
  contextSlots: [],
  providerPreference: { defaultProvider, allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: iso(19),
  updatedAt: iso(0),
});

const SESSIONS: ReadonlyArray<Session> = [
  buildSession(
    PAYMENTS_ID,
    'Fix the half-cent rounding drift in payments-api invoice totals',
    'anthropic',
  ),
  buildSession(
    NOTIFY_ID,
    'Add exponential backoff to notify-relay after 429s from the webhook consumer',
    'anthropic',
  ),
  buildSession(BILLING_ID, 'Wire billing-api monthly invoice export to CSV', 'codex'),
  buildSession(STOREFRONT_ID, 'Refactor storefront-web checkout flow state machine', 'anthropic'),
  buildSession(WEBCONSOLE_ID, 'Add an audit log to web-console admin actions', 'anthropic'),
];

type TurnSpec = {
  readonly sessionId: SessionId;
  readonly provider: ProviderName;
  readonly model: string;
  readonly count: number;
  readonly costPerTurn: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
};

const TURN_SPECS: ReadonlyArray<TurnSpec> = [
  {
    sessionId: PAYMENTS_ID,
    provider: 'anthropic',
    model: 'claude-opus-5',
    count: 10,
    costPerTurn: 3.2,
    tokensIn: 96_000,
    tokensOut: 6_200,
  },
  {
    sessionId: PAYMENTS_ID,
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    count: 16,
    costPerTurn: 2.1,
    tokensIn: 58_000,
    tokensOut: 4_100,
  },
  {
    sessionId: PAYMENTS_ID,
    provider: 'codex',
    model: 'gpt-6-astra',
    count: 8,
    costPerTurn: 3.1,
    tokensIn: 71_000,
    tokensOut: 5_200,
  },
  {
    sessionId: PAYMENTS_ID,
    provider: 'cursor',
    model: 'composer-2.5-fast',
    count: 6,
    costPerTurn: 1.6,
    tokensIn: 42_000,
    tokensOut: 3_100,
  },
  {
    sessionId: NOTIFY_ID,
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    count: 15,
    costPerTurn: 2.0,
    tokensIn: 54_000,
    tokensOut: 3_900,
  },
  {
    sessionId: NOTIFY_ID,
    provider: 'anthropic',
    model: 'claude-opus-5',
    count: 6,
    costPerTurn: 3.3,
    tokensIn: 91_000,
    tokensOut: 6_000,
  },
  {
    sessionId: NOTIFY_ID,
    provider: 'codex',
    model: 'gpt-5.6-sol',
    count: 7,
    costPerTurn: 2.6,
    tokensIn: 64_000,
    tokensOut: 4_700,
  },
  {
    sessionId: NOTIFY_ID,
    provider: 'cursor',
    model: 'claude-sonnet-5-high',
    count: 8,
    costPerTurn: 1.9,
    tokensIn: 49_000,
    tokensOut: 3_600,
  },
  {
    sessionId: BILLING_ID,
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    count: 9,
    costPerTurn: 1.5,
    tokensIn: 39_000,
    tokensOut: 2_800,
  },
  {
    sessionId: BILLING_ID,
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    count: 10,
    costPerTurn: 0.35,
    tokensIn: 18_000,
    tokensOut: 1_400,
  },
  {
    sessionId: BILLING_ID,
    provider: 'codex',
    model: 'gpt-5.6-sol',
    count: 5,
    costPerTurn: 2.2,
    tokensIn: 51_000,
    tokensOut: 3_700,
  },
  {
    sessionId: BILLING_ID,
    provider: 'cursor',
    model: 'composer-2.5-fast',
    count: 4,
    costPerTurn: 1.5,
    tokensIn: 38_000,
    tokensOut: 2_900,
  },
  {
    sessionId: STOREFRONT_ID,
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    count: 8,
    costPerTurn: 1.55,
    tokensIn: 41_000,
    tokensOut: 3_000,
  },
  {
    sessionId: STOREFRONT_ID,
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    count: 11,
    costPerTurn: 0.32,
    tokensIn: 17_000,
    tokensOut: 1_300,
  },
  {
    sessionId: STOREFRONT_ID,
    provider: 'cursor',
    model: 'composer-2.5-fast',
    count: 4,
    costPerTurn: 1.45,
    tokensIn: 36_000,
    tokensOut: 2_700,
  },
  {
    sessionId: WEBCONSOLE_ID,
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    count: 15,
    costPerTurn: 0.27,
    tokensIn: 15_000,
    tokensOut: 1_100,
  },
  {
    sessionId: WEBCONSOLE_ID,
    provider: 'codex',
    model: 'gpt-6-astra',
    count: 3,
    costPerTurn: 2.6,
    tokensIn: 60_000,
    tokensOut: 4_300,
  },
];

const buildTelemetry = (): Record<string, ReadonlyArray<TelemetryRecord>> => {
  const bySession = new Map<string, TelemetryRecord[]>();
  let seq = 0;
  for (const spec of TURN_SPECS) {
    for (let i = 0; i < spec.count; i += 1) {
      seq += 1;
      const jitter = 0.9 + ((i * 7) % 5) * 0.05;
      const record: TelemetryRecord = {
        id: `mock-impact-telemetry-${seq}` as TelemetryRecordId,
        runId: `mock-impact-run-${seq}` as ProviderRunId,
        sessionId: spec.sessionId,
        kind: 'turn',
        provider: spec.provider,
        model: spec.model,
        inputTokens: Math.round(spec.tokensIn * jitter),
        outputTokens: Math.round(spec.tokensOut * jitter),
        estimatedCostUsd: Number((spec.costPerTurn * jitter).toFixed(4)),
        recordedAt: iso(1 + (seq % 19), 8 + (seq % 10)),
      };
      const list = bySession.get(spec.sessionId) ?? [];
      list.push(record);
      bySession.set(spec.sessionId, list);
    }
  }
  return Object.fromEntries(bySession);
};

const PROVIDER_SPEND: ReadonlyArray<ProviderSpendEntry> = [
  { provider: 'anthropic', spentUsd: 152.37, capUsd: 170, pct: 0.896 },
  { provider: 'codex', spentUsd: 61.8, capUsd: 150, pct: 0.412 },
  { provider: 'cursor', spentUsd: 36.6, capUsd: 100, pct: 0.366 },
];

const BUDGET_RULES: ReadonlyArray<BudgetRule> = [
  {
    id: 'mock-impact-rule-anthropic',
    provider: 'anthropic',
    period: 'monthly',
    capUsd: 170,
    alertThresholdPct: 80,
    extraTokensBudget: null,
    createdAt: iso(24),
  },
  {
    id: 'mock-impact-rule-codex',
    provider: 'codex',
    period: 'monthly',
    capUsd: 150,
    alertThresholdPct: 85,
    extraTokensBudget: null,
    createdAt: iso(24),
  },
  {
    id: 'mock-impact-rule-cursor',
    provider: 'cursor',
    period: 'monthly',
    capUsd: 100,
    alertThresholdPct: 80,
    extraTokensBudget: null,
    createdAt: iso(24),
  },
];

const BUDGET_ALERTS: ReadonlyArray<BudgetAlert> = [
  {
    id: 'mock-impact-alert-anthropic-threshold',
    kind: 'provider-threshold',
    provider: 'anthropic',
    currentUsd: 152.37,
    capUsd: 170,
    createdAt: iso(1),
  },
];

const noop = async (): Promise<void> => undefined;

const seedImpactScene = (): void => {
  seedStudioChrome();
  useAppStore.setState({
    workspaces: [mockWorkspace({ id: WORKSPACE_ID, name: WORKSPACE_NAME })],
    sessions: SESSIONS,
    currentSessionId: PAYMENTS_ID,
    currentWorkspaceId: WORKSPACE_ID,
    sessionTelemetry: buildTelemetry(),
    providerSpendBreakdown: PROVIDER_SPEND,
    budgetRules: BUDGET_RULES,
    budgetAlerts: BUDGET_ALERTS,
    sessionBudgets: { [PAYMENTS_ID]: { sessionId: PAYMENTS_ID, softCapUsd: 120 } },
    loadBudgetRules: noop,
    loadBudgetAlerts: noop,
    loadSessionTelemetry: noop,
    loadSessionBudget: noop,
    saveBudgetRule: noop,
    deleteBudgetRule: noop,
    setSessionBudget: noop,
    dismissBudgetAlert: noop,
    refreshProviderSpendBreakdown: noop,
    setCurrentSession: noop,
  });
};

export const ImpactScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedImpactScene();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <StudioFrame
      target="impact"
      main={
        <ImpactStudio
          workspaceId={WORKSPACE_ID}
          initialScope={{ kind: 'provider', provider: 'anthropic' }}
          onClose={() => undefined}
        />
      }
    />
  );
};
