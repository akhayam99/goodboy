import { invokeCommand } from '../../shared/lib/invokeCommand';
import type {
  BudgetAlert,
  BudgetPeriod,
  ProviderBudgetOverview,
  ProviderBudgetStatus,
  BudgetRule,
  ProviderName,
  SessionId,
  SessionBudget,
  SessionBudgetOnExceed,
} from '@goodboy/types';

type Params = {
  provider: ProviderName;
  sessionId: SessionId;
};

export const invokeBudgetRuleUpsert = async (rule: BudgetRule): Promise<void> => {
  return invokeCommand<void>('budget_rule_upsert', { rule });
};

export const invokeBudgetRuleList = async (): Promise<BudgetRule[]> => {
  return invokeCommand<BudgetRule[]>('budget_rule_list');
};

export const invokeBudgetRuleDelete = async (id: string): Promise<void> => {
  return invokeCommand<void>('budget_rule_delete', { id });
};

export const invokeSessionBudgetSet = async (
  sessionId: string,
  softCapUsd: number,
  onExceed: SessionBudgetOnExceed,
): Promise<void> => {
  return invokeCommand<void>('session_budget_set', { sessionId, softCapUsd, onExceed });
};

export const invokeSessionBudgetClear = async (sessionId: string): Promise<void> => {
  return invokeCommand<void>('session_budget_clear', { sessionId });
};

export const invokeSessionBudgetGet = async (sessionId: string): Promise<SessionBudget | null> => {
  return invokeCommand<SessionBudget | null>('session_budget_get', { sessionId });
};

export const invokeBudgetAlertsList = async (): Promise<BudgetAlert[]> => {
  return invokeCommand<BudgetAlert[]>('budget_alerts_list');
};

export const invokeBudgetEmitAlerts = async ({
  provider,
  sessionId,
}: Params): Promise<BudgetAlert[]> => {
  return invokeCommand<BudgetAlert[]>('budget_emit_alerts', { input: { provider, sessionId } });
};

export const invokeBudgetAlertDismiss = async (id: string): Promise<void> => {
  return invokeCommand<void>('budget_alert_dismiss', { id });
};

export const invokeCheckProviderBudget = async (
  provider: ProviderName,
  period: BudgetPeriod,
): Promise<ProviderBudgetStatus> => {
  return invokeCommand<ProviderBudgetStatus>('check_provider_budget', { provider, period });
};

type OverviewParams = {
  readonly provider: ProviderName;
  readonly todayStartMs: number;
  readonly weekStartMs: number;
};

export const invokeProviderBudgetOverview = async ({
  provider,
  todayStartMs,
  weekStartMs,
}: OverviewParams): Promise<ProviderBudgetOverview> => {
  return invokeCommand<ProviderBudgetOverview>('provider_budget_overview', {
    provider,
    todayStartMs,
    weekStartMs,
  });
};
