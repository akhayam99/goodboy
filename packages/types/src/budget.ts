import type { IsoDateTime, SessionId } from './ids';
import type { ProviderName } from './provider';
import type { ProviderId } from './provider-registry';

export type BudgetPeriod = 'monthly';

export type BudgetRule = Readonly<{
  id: string;
  provider: ProviderName;
  period: BudgetPeriod;
  capUsd: number;
  alertThresholdPct: number;
  extraTokensBudget: number | null;
  createdAt: IsoDateTime;
}>;

export type SessionBudgetOnExceed = 'pause' | 'warn';

export type SessionBudget = Readonly<{
  sessionId: SessionId;
  softCapUsd: number;
  onExceed: SessionBudgetOnExceed;
}>;

export type BudgetCheckResult = Readonly<{
  remainingUsd: number | null;
  pct: number;
  exceeded: boolean;
  overThreshold: boolean;
}>;

export type ProviderBudgetStatus = BudgetCheckResult &
  Readonly<{
    spentUsd: number;
    capUsd: number | null;
    thresholdPct: number | null;
    windowStartMs: number;
    windowEndMs: number;
  }>;

export type ProviderSpendPeriods = Readonly<{
  todayUsd: number;
  last7DaysUsd: number;
  thisMonthUsd: number;
}>;

export type ProviderBudgetOverview = Readonly<{
  status: ProviderBudgetStatus;
  periods: ProviderSpendPeriods;
}>;

export type RoutingReason =
  | 'preferred'
  | 'fallback-budget'
  | 'fallback-threshold'
  | 'fallback-disconnected'
  | 'fallback-cooldown'
  | 'all-exceeded'
  | 'forced-over-budget'
  | 'override'
  | 'override-off';

export type RoutingDecision = Readonly<{
  selectedProvider: ProviderId;
  selectedModel: string;
  reason: RoutingReason;
  fallbackUsed: boolean;
  fallbackFrom?: ProviderId;
}>;

export type BudgetAlertKind =
  'provider-threshold' | 'provider-exceeded' | 'session-threshold' | 'session-exceeded';

export type BudgetAlert = Readonly<{
  id: string;
  kind: BudgetAlertKind;
  provider?: ProviderName;
  sessionId?: SessionId;
  currentUsd: number;
  capUsd: number;
  createdAt: IsoDateTime;
  dismissedAt?: IsoDateTime;
}>;
