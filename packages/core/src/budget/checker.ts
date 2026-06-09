import type {
  BudgetCheckResult,
  BudgetPeriod,
  BudgetRule,
  IsoDateTime,
  ProviderName,
  SessionBudget,
  SessionId,
} from '@goodboy/types';
import type { Database } from '@goodboy/db';

type BudgetRuleRow = {
  id: string;
  provider: ProviderName;
  period: BudgetPeriod;
  cap_usd: number;
  alert_threshold_pct: number;
  extra_tokens_budget: number | null;
  created_at: string;
};

type SessionBudgetRow = {
  session_id: string;
  soft_cap_usd: number;
};

type CostSumRow = {
  total: number | null;
};

export function getPeriodWindow(period: BudgetPeriod): { start: string; end: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1)).toISOString();
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)).toISOString();
  return { start, end };
}

const UNSET_RESULT: BudgetCheckResult = { remainingUsd: Infinity, pct: 0, exceeded: false };

export async function checkProviderBudget(
  db: Database,
  provider: ProviderName,
  period: BudgetPeriod,
): Promise<BudgetCheckResult> {
  const ruleRows = await db.select<BudgetRuleRow>(
    `SELECT id, provider, period, cap_usd, alert_threshold_pct, extra_tokens_budget, created_at
       FROM budget_rules
      WHERE provider = ? AND period = ?
      LIMIT 1`,
    [provider, period],
  );

  if (ruleRows.length === 0) return UNSET_RESULT;

  const row = ruleRows[0] as BudgetRuleRow;
  const rule: BudgetRule = {
    id: row.id,
    provider: row.provider,
    period: row.period,
    capUsd: row.cap_usd,
    alertThresholdPct: row.alert_threshold_pct,
    extraTokensBudget: row.extra_tokens_budget ?? null,
    createdAt: row.created_at as IsoDateTime,
  };

  const { start, end } = getPeriodWindow(period);
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);

  const costRows = await db.select<CostSumRow>(
    `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total
       FROM telemetry_records
      WHERE provider = ?
        AND recorded_at >= ?
        AND recorded_at <= ?`,
    [provider, startMs, endMs],
  );

  const spent = costRows[0]?.total ?? 0;
  const remaining = rule.capUsd - spent;
  const pct = rule.capUsd > 0 ? (spent / rule.capUsd) * 100 : 0;

  return {
    remainingUsd: remaining,
    pct,
    exceeded: spent > rule.capUsd,
  };
}

export async function checkSessionBudget(
  db: Database,
  sessionId: SessionId,
): Promise<BudgetCheckResult> {
  const budgetRows = await db.select<SessionBudgetRow>(
    `SELECT session_id, soft_cap_usd
       FROM session_budgets
      WHERE session_id = ?
      LIMIT 1`,
    [sessionId],
  );

  if (budgetRows.length === 0) return UNSET_RESULT;

  const budgetRow = budgetRows[0] as SessionBudgetRow;
  const budget: SessionBudget = {
    sessionId: budgetRow.session_id as SessionId,
    softCapUsd: budgetRow.soft_cap_usd,
  };

  const costRows = await db.select<CostSumRow>(
    `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total
       FROM telemetry_records
      WHERE session_id = ?`,
    [sessionId],
  );

  const spent = costRows[0]?.total ?? 0;
  const remaining = budget.softCapUsd - spent;
  const pct = budget.softCapUsd > 0 ? (spent / budget.softCapUsd) * 100 : 0;

  return {
    remainingUsd: remaining,
    pct,
    exceeded: spent > budget.softCapUsd,
  };
}
