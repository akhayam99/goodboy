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

type ProviderCostRow = {
  measured: number | null;
  committed: number | null;
};

type SessionCostRow = {
  total: number | null;
};

export const getPeriodWindow = (period: BudgetPeriod): { start: string; end: string } => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1)).toISOString();
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)).toISOString();
  return { start, end };
};

const UNSET_RESULT: BudgetCheckResult = {
  remainingUsd: Infinity,
  pct: 0,
  exceeded: false,
  overThreshold: false,
  measuredUsd: 0,
  committedUsd: 0,
};

export const checkProviderBudget = async (
  db: Database,
  provider: ProviderName,
  period: BudgetPeriod,
): Promise<BudgetCheckResult> => {
  const ruleRows = await db.select<BudgetRuleRow>(
    `SELECT id, provider, period, cap_usd, alert_threshold_pct, extra_tokens_budget, created_at
       FROM budget_rules
      WHERE provider = ? AND period = ?
      LIMIT 1`,
    [provider, period],
  );

  if (ruleRows.length === 0) {
    return UNSET_RESULT;
  }

  const row = ruleRows[0]!;
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

  const costRows = await db.select<ProviderCostRow>(
    `SELECT
       COALESCE((
         SELECT SUM(estimated_cost_usd)
           FROM telemetry_records
          WHERE provider = ? AND recorded_at >= ? AND recorded_at <= ?
       ), 0) AS measured,
       COALESCE((
         SELECT SUM(
           CASE
             WHEN ticket.reservation_status = 'reserved' THEN MAX(ticket.estimated_spend_usd - COALESCE((
               SELECT SUM(usage.estimated_cost_usd) FROM telemetry_records usage WHERE usage.invocation_id = ticket.id
             ), 0), 0)
             WHEN ticket.reservation_status = 'settled' AND ticket.measurement_status = 'unknown' THEN ticket.estimated_spend_usd
             ELSE 0
           END
         )
           FROM invocation_tickets ticket
          WHERE ticket.budget_identity = ?
            AND ticket.budget_period_start = ?
            AND ticket.budget_period_end = ?
       ), 0) AS committed`,
    [provider, startMs, endMs, provider, startMs, endMs],
  );

  const measured = costRows[0]?.measured ?? 0;
  const committed = costRows[0]?.committed ?? 0;
  const spent = measured + committed;
  const remaining = rule.capUsd - spent;
  const pct = rule.capUsd > 0 ? (spent / rule.capUsd) * 100 : 0;
  const exceeded = spent > rule.capUsd;

  return {
    remainingUsd: remaining,
    pct,
    exceeded,
    overThreshold: !exceeded && pct >= rule.alertThresholdPct,
    measuredUsd: measured,
    committedUsd: committed,
  };
};

export const checkSessionBudget = async (
  db: Database,
  sessionId: SessionId,
): Promise<BudgetCheckResult> => {
  const budgetRows = await db.select<SessionBudgetRow>(
    `SELECT session_id, soft_cap_usd
       FROM session_budgets
      WHERE session_id = ?
      LIMIT 1`,
    [sessionId],
  );

  if (budgetRows.length === 0) {
    return UNSET_RESULT;
  }

  const budgetRow = budgetRows[0]!;
  const budget: SessionBudget = {
    sessionId: budgetRow.session_id as SessionId,
    softCapUsd: budgetRow.soft_cap_usd,
  };

  const costRows = await db.select<SessionCostRow>(
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
    overThreshold: false,
    measuredUsd: spent,
    committedUsd: 0,
  };
};
