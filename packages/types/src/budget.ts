import type { IsoDateTime, TaskId } from './ids';
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

export type TaskBudget = Readonly<{
  taskId: TaskId;
  softCapUsd: number;
}>;

export type BudgetCheckResult = Readonly<{
  remainingUsd: number;
  pct: number;
  exceeded: boolean;
}>;

export type RoutingReason = 'preferred' | 'fallback-budget' | 'all-exceeded' | 'override';

export type RoutingDecision = Readonly<{
  selectedProvider: ProviderId;
  selectedModel: string;
  reason: RoutingReason;
  fallbackUsed: boolean;
  fallbackFrom?: ProviderId;
}>;

export type BudgetAlertKind =
  | 'provider-threshold'
  | 'provider-exceeded'
  | 'task-threshold'
  | 'task-exceeded';

export type BudgetAlert = Readonly<{
  id: string;
  kind: BudgetAlertKind;
  provider?: ProviderName;
  taskId?: TaskId;
  currentUsd: number;
  capUsd: number;
  createdAt: IsoDateTime;
  dismissedAt?: IsoDateTime;
}>;
