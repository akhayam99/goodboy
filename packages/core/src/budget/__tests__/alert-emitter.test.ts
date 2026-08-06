import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BudgetAlert, BudgetCheckResult, BudgetRule, SessionBudget } from '@goodboy/types';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import type { Database } from '@goodboy/db';

vi.mock('@goodboy/db', () => ({
  listBudgetRules: vi.fn(),
  listBudgetAlerts: vi.fn(),
  insertBudgetAlert: vi.fn(),
  getSessionBudget: vi.fn(),
}));

import {
  listBudgetRules,
  listBudgetAlerts,
  insertBudgetAlert,
  getSessionBudget,
} from '@goodboy/db';

import { emitBudgetAlerts } from '../alert-emitter';
import type { AlertEmitterDeps } from '../alert-emitter';

const NOW = '2026-05-07T00:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'sess-abc' as SessionId;

const RULE: BudgetRule = {
  id: 'rule-1',
  provider: 'anthropic',
  period: 'monthly',
  capUsd: 100,
  alertThresholdPct: 80,
  extraTokensBudget: null,
  createdAt: NOW,
};

function makeResult(pct: number): BudgetCheckResult {
  const capUsd = 100;
  const spent = pct;
  const exceeded = spent > capUsd;
  return {
    remainingUsd: capUsd - spent,
    pct,
    exceeded,
    overThreshold: !exceeded && pct >= RULE.alertThresholdPct,
  };
}

function makeDeps(
  providerResult: BudgetCheckResult,
  sessionResult: BudgetCheckResult,
): AlertEmitterDeps {
  return {
    db: {} as Database,
    checkProviderBudget: vi.fn().mockResolvedValue(providerResult),
    checkSessionBudget: vi.fn().mockResolvedValue(sessionResult),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listBudgetRules).mockResolvedValue([RULE]);
  vi.mocked(listBudgetAlerts).mockResolvedValue([]);
  vi.mocked(insertBudgetAlert).mockResolvedValue(undefined);
  vi.mocked(getSessionBudget).mockResolvedValue(null);
});

describe('emitBudgetAlerts', () => {
  it('provider at 80% → emits provider-threshold alert', async () => {
    const deps = makeDeps(makeResult(80), {
      remainingUsd: Infinity,
      pct: 0,
      exceeded: false,
      overThreshold: false,
    });

    const alerts = await emitBudgetAlerts(deps, { provider: 'anthropic', sessionId: SESSION_ID });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.kind).toBe('provider-threshold');
    expect(insertBudgetAlert).toHaveBeenCalledOnce();
  });

  it('provider at 100% → emits provider-exceeded alert', async () => {
    const deps = makeDeps(makeResult(100), {
      remainingUsd: Infinity,
      pct: 0,
      exceeded: false,
      overThreshold: false,
    });

    const alerts = await emitBudgetAlerts(deps, { provider: 'anthropic', sessionId: SESSION_ID });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.kind).toBe('provider-exceeded');
  });

  it('provider under threshold → no alert emitted', async () => {
    const deps = makeDeps(makeResult(50), {
      remainingUsd: Infinity,
      pct: 0,
      exceeded: false,
      overThreshold: false,
    });

    const alerts = await emitBudgetAlerts(deps, { provider: 'anthropic', sessionId: SESSION_ID });

    expect(alerts).toHaveLength(0);
    expect(insertBudgetAlert).not.toHaveBeenCalled();
  });

  it('session over cap → emits session-exceeded alert', async () => {
    const sessionBudget: SessionBudget = { sessionId: SESSION_ID, softCapUsd: 50 };
    vi.mocked(getSessionBudget).mockResolvedValue(sessionBudget);

    const deps = makeDeps(makeResult(50), {
      remainingUsd: -10,
      pct: 120,
      exceeded: true,
      overThreshold: false,
    });

    const alerts = await emitBudgetAlerts(deps, { provider: 'anthropic', sessionId: SESSION_ID });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.kind).toBe('session-exceeded');
  });

  it('dedup: undismissed alert of same kind already exists → no duplicate', async () => {
    const existingAlert: BudgetAlert = {
      id: 'existing-1',
      kind: 'provider-threshold',
      provider: 'anthropic',
      currentUsd: 80,
      capUsd: 100,
      createdAt: NOW,
    };
    vi.mocked(listBudgetAlerts).mockResolvedValue([existingAlert]);

    const deps = makeDeps(makeResult(80), {
      remainingUsd: Infinity,
      pct: 0,
      exceeded: false,
      overThreshold: false,
    });

    const alerts = await emitBudgetAlerts(deps, { provider: 'anthropic', sessionId: SESSION_ID });

    expect(alerts).toHaveLength(0);
    expect(insertBudgetAlert).not.toHaveBeenCalled();
  });

  it('dismissed alert exists → new alert emitted', async () => {
    const dismissedAlert: BudgetAlert = {
      id: 'dismissed-1',
      kind: 'provider-threshold',
      provider: 'anthropic',
      currentUsd: 80,
      capUsd: 100,
      createdAt: NOW,
      dismissedAt: NOW,
    };
    vi.mocked(listBudgetAlerts).mockResolvedValue([]);

    const deps = makeDeps(makeResult(80), {
      remainingUsd: Infinity,
      pct: 0,
      exceeded: false,
      overThreshold: false,
    });

    const alerts = await emitBudgetAlerts(deps, { provider: 'anthropic', sessionId: SESSION_ID });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.kind).toBe('provider-threshold');
    void dismissedAlert;
  });
});
