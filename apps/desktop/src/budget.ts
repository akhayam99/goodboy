import { invoke } from '@tauri-apps/api/core';
import type {
  BudgetAlert,
  BudgetCheckResult,
  BudgetPeriod,
  BudgetRule,
  ProviderName,
  TaskBudget,
} from '@kay-am/types';

export async function invokeBudgetRuleUpsert(rule: BudgetRule): Promise<void> {
  return invoke<void>('budget_rule_upsert', { rule });
}

export async function invokeBudgetRuleList(): Promise<BudgetRule[]> {
  return invoke<BudgetRule[]>('budget_rule_list');
}

export async function invokeBudgetRuleDelete(id: string): Promise<void> {
  return invoke<void>('budget_rule_delete', { id });
}

export async function invokeSessionBudgetSet(taskId: string, softCapUsd: number): Promise<void> {
  return invoke<void>('task_budget_set', { taskId, softCapUsd });
}

export async function invokeSessionBudgetGet(taskId: string): Promise<TaskBudget | null> {
  return invoke<TaskBudget | null>('task_budget_get', { taskId });
}

export async function invokeBudgetAlertsList(): Promise<BudgetAlert[]> {
  return invoke<BudgetAlert[]>('budget_alerts_list');
}

export async function invokeBudgetAlertDismiss(id: string): Promise<void> {
  return invoke<void>('budget_alert_dismiss', { id });
}

export async function invokeCheckProviderBudget(
  provider: ProviderName,
  period: BudgetPeriod,
): Promise<BudgetCheckResult> {
  return invoke<BudgetCheckResult>('check_provider_budget', { provider, period });
}
