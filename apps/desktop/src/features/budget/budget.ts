import { invoke } from '@tauri-apps/api/core';
import type {
  BudgetAlert,
  BudgetCheckResult,
  BudgetPeriod,
  BudgetRule,
  ProviderName,
  SessionBudget,
} from '@goodboy/types';

export const invokeBudgetRuleUpsert = async (rule: BudgetRule): Promise<void> => {
  return invoke<void>('budget_rule_upsert', { rule });
};

export const invokeBudgetRuleList = async (): Promise<BudgetRule[]> => {
  return invoke<BudgetRule[]>('budget_rule_list');
};

export const invokeBudgetRuleDelete = async (id: string): Promise<void> => {
  return invoke<void>('budget_rule_delete', { id });
};

export const invokeSessionBudgetSet = async (
  sessionId: string,
  softCapUsd: number,
): Promise<void> => {
  return invoke<void>('session_budget_set', { sessionId, softCapUsd });
};

export const invokeSessionBudgetGet = async (sessionId: string): Promise<SessionBudget | null> => {
  return invoke<SessionBudget | null>('session_budget_get', { sessionId });
};

export const invokeBudgetAlertsList = async (): Promise<BudgetAlert[]> => {
  return invoke<BudgetAlert[]>('budget_alerts_list');
};

export const invokeBudgetAlertDismiss = async (id: string): Promise<void> => {
  return invoke<void>('budget_alert_dismiss', { id });
};

export const invokeCheckProviderBudget = async (
  provider: ProviderName,
  period: BudgetPeriod,
): Promise<BudgetCheckResult> => {
  return invoke<BudgetCheckResult>('check_provider_budget', { provider, period });
};
