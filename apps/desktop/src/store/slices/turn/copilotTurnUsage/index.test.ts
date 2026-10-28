import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type ProviderRunId,
  type ProviderUsage,
  type TurnEvent,
} from '@goodboy/types';
import { copilotTurnUsage } from '.';

const AT = brandId<IsoDateTime>({ value: '2026-10-28T00:00:00.000Z' });

type RunParams = {
  readonly runId: string;
  readonly providerSessionId: string;
  readonly total: number;
  readonly nanoAiu: number;
};

const usageOf = ({ total, nanoAiu }: Pick<RunParams, 'total' | 'nanoAiu'>): ProviderUsage => ({
  inputTokens: 1,
  outputTokens: 1,
  cachedInputTokens: 0,
  premiumRequests: total,
  nanoAiu,
  sessionPremiumRequests: total,
  sessionNanoAiu: nanoAiu,
  estimatedCostUsd: 0,
});

const initOf = ({ runId, providerSessionId }: RunParams): TurnEvent => ({
  kind: 'provider_session_init',
  runId: brandId<ProviderRunId>({ value: runId }),
  providerSessionId,
  at: AT,
});

const usageEventOf = ({ runId, total, nanoAiu }: RunParams) => ({
  kind: 'usage' as const,
  runId: brandId<ProviderRunId>({ value: runId }),
  usage: usageOf({ total, nanoAiu }),
  at: AT,
});

describe('copilotTurnUsage', () => {
  it('keeps the whole total for the first turn of a session', () => {
    const run: RunParams = {
      runId: 'run-1',
      providerSessionId: 'ledger-core-1',
      total: 0.33,
      nanoAiu: 100,
    };
    const result = copilotTurnUsage({ event: usageEventOf(run), events: [initOf(run)] });
    expect(result.usage.premiumRequests).toBe(0.33);
    expect(result.usage.nanoAiu).toBe(100);
  });

  it('records only the share of a resumed turn', () => {
    const first: RunParams = {
      runId: 'run-1',
      providerSessionId: 'ledger-core-1',
      total: 0.33,
      nanoAiu: 100,
    };
    const second: RunParams = {
      runId: 'run-2',
      providerSessionId: 'ledger-core-1',
      total: 0.66,
      nanoAiu: 250,
    };
    const stored = copilotTurnUsage({
      event: usageEventOf(first),
      events: [initOf(first)],
    });
    const result = copilotTurnUsage({
      event: usageEventOf(second),
      events: [initOf(first), stored, initOf(second)],
    });
    expect(result.usage.premiumRequests).toBe(0.33);
    expect(result.usage.nanoAiu).toBe(150);
    expect(result.usage.sessionPremiumRequests).toBe(0.66);
    expect(result.usage.sessionNanoAiu).toBe(250);
  });

  it('starts from zero on a fresh session after a reset', () => {
    const old: RunParams = {
      runId: 'run-1',
      providerSessionId: 'ledger-core-1',
      total: 0.66,
      nanoAiu: 250,
    };
    const fresh: RunParams = {
      runId: 'run-2',
      providerSessionId: 'ledger-core-2',
      total: 0.33,
      nanoAiu: 90,
    };
    const result = copilotTurnUsage({
      event: usageEventOf(fresh),
      events: [initOf(old), usageEventOf(old), initOf(fresh)],
    });
    expect(result.usage.premiumRequests).toBe(0.33);
    expect(result.usage.nanoAiu).toBe(90);
  });

  it('treats a turn that reported no session id as a fresh session', () => {
    const old: RunParams = {
      runId: 'run-1',
      providerSessionId: 'ledger-core-1',
      total: 0.66,
      nanoAiu: 250,
    };
    const next: RunParams = { runId: 'run-2', providerSessionId: 'x', total: 0.33, nanoAiu: 90 };
    const result = copilotTurnUsage({
      event: usageEventOf(next),
      events: [initOf(old), usageEventOf(old)],
    });
    expect(result.usage.premiumRequests).toBe(0.33);
  });

  it('never goes below zero when the total fell', () => {
    const old: RunParams = {
      runId: 'run-1',
      providerSessionId: 'ledger-core-1',
      total: 1,
      nanoAiu: 500,
    };
    const next: RunParams = {
      runId: 'run-2',
      providerSessionId: 'ledger-core-1',
      total: 0.5,
      nanoAiu: 100,
    };
    const result = copilotTurnUsage({
      event: usageEventOf(next),
      events: [initOf(old), usageEventOf(old), initOf(next)],
    });
    expect(result.usage.premiumRequests).toBe(0);
    expect(result.usage.nanoAiu).toBe(0);
  });

  it('leaves the usage of another provider untouched', () => {
    const event = {
      kind: 'usage' as const,
      runId: brandId<ProviderRunId>({ value: 'run-9' }),
      usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0, estimatedCostUsd: 0.1 },
      at: AT,
    };
    expect(copilotTurnUsage({ event, events: [] })).toBe(event);
  });
});
