import { useEffect, useState } from 'react';
import type {
  BudgetAlert,
  BudgetRule,
  IsoDateTime,
  ProviderBudgetStatus,
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
import type { ProviderBudgetStatuses } from '../../../../store/slices/budget';

const WORKSPACE_ID = 'mock-impact-workspace-harborline' as WorkspaceId;
const WORKSPACE_NAME = 'Harborline';

const NOW = Date.now();

const iso = (daysAgo: number, hour = 10): IsoDateTime =>
  new Date(
    Math.min(NOW, NOW - daysAgo * 86_400_000 + hour * 3_600_000),
  ).toISOString() as IsoDateTime;

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
  buildSession(PAYMENTS_ID, 'Stop retried webhooks posting a second credit', 'anthropic'),
  buildSession(NOTIFY_ID, 'Warn merchants before a payout hold', 'anthropic'),
  buildSession(BILLING_ID, 'Reconcile the settlement export against the ledger snapshot', 'codex'),
  buildSession(STOREFRONT_ID, 'Per-tenant limits on the public API', 'anthropic'),
  buildSession(WEBCONSOLE_ID, 'Retire the legacy export cron job', 'anthropic'),
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
  { provider: 'anthropic', spentUsd: 152.37 },
  { provider: 'codex', spentUsd: 61.8 },
  { provider: 'cursor', spentUsd: 36.6 },
];

const MONTH_START_MS = Date.UTC(new Date(NOW).getUTCFullYear(), new Date(NOW).getUTCMonth(), 1);
const MONTH_END_MS =
  Date.UTC(new Date(NOW).getUTCFullYear(), new Date(NOW).getUTCMonth() + 1, 1) - 1;

type StatusParams = {
  readonly spentUsd: number;
  readonly capUsd: number;
  readonly thresholdPct: number;
};

const monthStatus = ({ spentUsd, capUsd, thresholdPct }: StatusParams): ProviderBudgetStatus => {
  const pct = (spentUsd / capUsd) * 100;
  return {
    remainingUsd: capUsd - spentUsd,
    pct,
    exceeded: spentUsd > capUsd,
    overThreshold: spentUsd <= capUsd && pct >= thresholdPct,
    spentUsd,
    capUsd,
    thresholdPct,
    windowStartMs: MONTH_START_MS,
    windowEndMs: MONTH_END_MS,
  };
};

const PROVIDER_BUDGET_STATUS: ProviderBudgetStatuses = {
  anthropic: monthStatus({ spentUsd: 152.37, capUsd: 170, thresholdPct: 80 }),
  codex: monthStatus({ spentUsd: 61.8, capUsd: 150, thresholdPct: 85 }),
  cursor: monthStatus({ spentUsd: 36.6, capUsd: 100, thresholdPct: 80 }),
};

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
    providerBudgetStatus: PROVIDER_BUDGET_STATUS,
    budgetRules: BUDGET_RULES,
    budgetAlerts: BUDGET_ALERTS,
    sessionBudgets: {
      [PAYMENTS_ID]: { sessionId: PAYMENTS_ID, softCapUsd: 120, onExceed: 'pause' },
    },
    loadBudgetRules: noop,
    loadBudgetAlerts: noop,
    loadSessionTelemetry: noop,
    loadSessionBudget: noop,
    saveBudgetRule: noop,
    deleteBudgetRule: noop,
    setSessionBudget: noop,
    dismissBudgetAlert: noop,
    refreshProviderSpendBreakdown: noop,
    refreshProviderBudgetStatus: noop,
    navigate: () => undefined,
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
