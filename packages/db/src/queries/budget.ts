import type { BudgetAlert, BudgetAlertKind, BudgetRule, TaskBudget } from '@kay-am/types';
import type { IsoDateTime, TaskId } from '@kay-am/types';
import type { ProviderName } from '@kay-am/types';
import type { Database } from '../client';

interface BudgetRuleRow {
  id: string;
  provider: ProviderName;
  period: string;
  cap_usd: number;
  alert_threshold_pct: number;
  extra_tokens_budget: number | null;
  created_at: string;
}

function toBudgetRule(row: BudgetRuleRow): BudgetRule {
  return {
    id: row.id,
    provider: row.provider,
    period: row.period as 'monthly',
    capUsd: row.cap_usd,
    alertThresholdPct: row.alert_threshold_pct,
    extraTokensBudget: row.extra_tokens_budget ?? null,
    createdAt: row.created_at as IsoDateTime,
  };
}

export async function insertBudgetRule(db: Database, rule: BudgetRule): Promise<void> {
  await db.execute(
    `INSERT INTO budget_rules
      (id, provider, period, cap_usd, alert_threshold_pct, extra_tokens_budget, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      rule.id,
      rule.provider,
      rule.period,
      rule.capUsd,
      rule.alertThresholdPct,
      rule.extraTokensBudget ?? null,
      rule.createdAt,
    ],
  );
}

export async function listBudgetRules(db: Database): Promise<ReadonlyArray<BudgetRule>> {
  const rows = await db.select<BudgetRuleRow>('SELECT * FROM budget_rules ORDER BY created_at ASC');
  return rows.map(toBudgetRule);
}

export async function deleteBudgetRule(db: Database, id: string): Promise<void> {
  await db.execute('DELETE FROM budget_rules WHERE id = ?', [id]);
}

interface TaskBudgetRow {
  task_id: string;
  soft_cap_usd: number;
}

function toTaskBudget(row: TaskBudgetRow): TaskBudget {
  return {
    taskId: row.task_id as TaskId,
    softCapUsd: row.soft_cap_usd,
  };
}

export async function upsertTaskBudget(
  db: Database,
  taskId: TaskId,
  softCapUsd: number,
): Promise<void> {
  await db.execute(
    `INSERT INTO task_budgets (task_id, soft_cap_usd)
     VALUES (?, ?)
     ON CONFLICT(task_id) DO UPDATE SET soft_cap_usd = excluded.soft_cap_usd`,
    [taskId, softCapUsd],
  );
}

export async function getTaskBudget(db: Database, taskId: TaskId): Promise<TaskBudget | null> {
  const rows = await db.select<TaskBudgetRow>('SELECT * FROM task_budgets WHERE task_id = ?', [
    taskId,
  ]);
  return rows[0] ? toTaskBudget(rows[0]) : null;
}

interface BudgetAlertRow {
  id: string;
  kind: BudgetAlertKind;
  provider: string | null;
  task_id: string | null;
  current_usd: number;
  cap_usd: number;
  created_at: string;
  dismissed_at: string | null;
}

function toBudgetAlert(row: BudgetAlertRow): BudgetAlert {
  return {
    id: row.id,
    kind: row.kind,
    provider: row.provider ? (row.provider as ProviderName) : undefined,
    taskId: row.task_id ? (row.task_id as TaskId) : undefined,
    currentUsd: row.current_usd,
    capUsd: row.cap_usd,
    createdAt: row.created_at as IsoDateTime,
    dismissedAt: row.dismissed_at ? (row.dismissed_at as IsoDateTime) : undefined,
  };
}

export async function insertBudgetAlert(db: Database, alert: BudgetAlert): Promise<void> {
  await db.execute(
    `INSERT INTO budget_alerts
      (id, kind, provider, task_id, current_usd, cap_usd, created_at, dismissed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      alert.id,
      alert.kind,
      alert.provider ?? null,
      alert.taskId ?? null,
      alert.currentUsd,
      alert.capUsd,
      alert.createdAt,
      alert.dismissedAt ?? null,
    ],
  );
}

export interface ListBudgetAlertsOptions {
  readonly taskId?: TaskId;
  readonly provider?: ProviderName;
  readonly undismissedOnly?: boolean;
}

export async function listBudgetAlerts(
  db: Database,
  opts?: ListBudgetAlertsOptions,
): Promise<ReadonlyArray<BudgetAlert>> {
  let query = 'SELECT * FROM budget_alerts WHERE 1 = 1';
  const params: unknown[] = [];

  if (opts?.taskId) {
    query += ' AND task_id = ?';
    params.push(opts.taskId);
  }

  if (opts?.provider) {
    query += ' AND provider = ?';
    params.push(opts.provider);
  }

  if (opts?.undismissedOnly) {
    query += ' AND dismissed_at IS NULL';
  }

  query += ' ORDER BY created_at DESC';

  const rows = await db.select<BudgetAlertRow>(query, params);
  return rows.map(toBudgetAlert);
}

export async function dismissBudgetAlert(
  db: Database,
  id: string,
  dismissedAt: IsoDateTime,
): Promise<void> {
  await db.execute('UPDATE budget_alerts SET dismissed_at = ? WHERE id = ?', [dismissedAt, id]);
}
