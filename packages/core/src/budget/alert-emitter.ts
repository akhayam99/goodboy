import type { BudgetAlert, BudgetAlertKind, BudgetCheckResult, BudgetPeriod } from '@goodboy/types';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import type { ProviderName } from '@goodboy/types';
import type { Database } from '@goodboy/db';
import {
  getSessionBudget,
  insertBudgetAlert,
  listBudgetAlerts,
  listBudgetRules,
} from '@goodboy/db';

export type AlertEmitterDeps = {
  db: Database;
  checkProviderBudget: (provider: ProviderName, period: BudgetPeriod) => Promise<BudgetCheckResult>;
  checkSessionBudget: (sessionId: SessionId) => Promise<BudgetCheckResult>;
};

export const getCurrentPeriodKey = (period: BudgetPeriod): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  if (period === 'monthly') {
    return `${year}-${month}`;
  }
  return `${year}-${month}`;
};

function providerAlertKind(
  result: BudgetCheckResult,
  thresholdPct: number,
): BudgetAlertKind | null {
  if (result.pct >= 100) return 'provider-exceeded';
  if (result.pct >= thresholdPct) return 'provider-threshold';
  return null;
}

function sessionAlertKind(result: BudgetCheckResult, thresholdPct: number): BudgetAlertKind | null {
  if (result.pct >= 100) return 'session-exceeded';
  if (result.pct >= thresholdPct) return 'session-threshold';
  return null;
}

export const emitBudgetAlerts = async (
  deps: AlertEmitterDeps,
  context: { provider: ProviderName; sessionId: SessionId },
): Promise<BudgetAlert[]> => {
  const { db, checkProviderBudget, checkSessionBudget } = deps;
  const { provider, sessionId } = context;

  const period: BudgetPeriod = 'monthly';
  const [rules, providerResult, sessionResult, sessionBudget] = await Promise.all([
    listBudgetRules(db),
    checkProviderBudget(provider, period),
    checkSessionBudget(sessionId),
    getSessionBudget(db, sessionId),
  ]);

  const created: BudgetAlert[] = [];
  const now = new Date().toISOString() as IsoDateTime;

  const providerRule = rules.find((r) => r.provider === provider && r.period === period);
  const kind = providerAlertKind(providerResult, providerRule?.alertThresholdPct ?? 80);

  if (kind !== null && providerRule !== undefined) {
    const existing = await listBudgetAlerts(db, { provider, undismissedOnly: true });
    const alreadyExists = existing.some((a) => a.kind === kind);
    if (!alreadyExists) {
      const spentUsd = providerRule.capUsd - providerResult.remainingUsd;
      const alert: BudgetAlert = {
        id: crypto.randomUUID(),
        kind,
        provider,
        currentUsd: spentUsd,
        capUsd: providerRule.capUsd,
        createdAt: now,
      };
      await insertBudgetAlert(db, alert);
      created.push(alert);
    }
  }

  if (sessionBudget !== null) {
    const sKind = sessionAlertKind(sessionResult, 80);
    if (sKind !== null) {
      const existing = await listBudgetAlerts(db, { sessionId, undismissedOnly: true });
      const alreadyExists = existing.some((a) => a.kind === sKind);
      if (!alreadyExists) {
        const spentUsd = sessionBudget.softCapUsd - sessionResult.remainingUsd;
        const alert: BudgetAlert = {
          id: crypto.randomUUID(),
          kind: sKind,
          sessionId,
          currentUsd: spentUsd,
          capUsd: sessionBudget.softCapUsd,
          createdAt: now,
        };
        await insertBudgetAlert(db, alert);
        created.push(alert);
      }
    }
  }

  return created;
};
