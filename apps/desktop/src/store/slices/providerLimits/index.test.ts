// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderLimits } from '@goodboy/types';

const { listSpy, upsertSpy, invokeSpy } = vi.hoisted(() => ({
  listSpy: vi.fn(),
  upsertSpy: vi.fn(),
  invokeSpy: vi.fn(),
}));

vi.mock('@goodboy/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/db')>();
  return { ...actual, listProviderLimits: listSpy, upsertProviderLimits: upsertSpy };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeSpy }));

import { createProviderLimitsSlice } from './index';

const WEEKLY_WARNING: ProviderLimits = {
  providerId: 'anthropic',
  plan: null,
  status: 'warning',
  windows: [
    {
      kind: 'weekly',
      model: null,
      status: 'warning',
      usedFraction: 0.88,
      resetsAt: '2099-01-05T09:00:00.000Z' as IsoDateTime,
    },
  ],
  observedAt: '2099-01-01T09:00:00.000Z' as IsoDateTime,
};

const FIVE_HOUR_OK: ProviderLimits = {
  providerId: 'anthropic',
  plan: null,
  status: 'ok',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'ok',
      usedFraction: null,
      resetsAt: '2099-01-01T14:00:00.000Z' as IsoDateTime,
    },
  ],
  observedAt: '2099-01-01T10:00:00.000Z' as IsoDateTime,
};

const harness = () => {
  let state: Record<string, unknown> = {};
  const set = (
    patch: Record<string, unknown> | ((s: Record<string, unknown>) => Record<string, unknown>),
  ) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  };
  const get = () => state;
  const slice = createProviderLimitsSlice(set as never, get as never);
  state = { ...slice };
  return { slice, read: () => state };
};

beforeEach(() => {
  listSpy.mockReset();
  upsertSpy.mockReset();
  invokeSpy.mockReset();
  upsertSpy.mockResolvedValue(undefined);
});

describe('providerLimits slice', () => {
  it('loads the last observation per provider from the database', async () => {
    listSpy.mockResolvedValue([WEEKLY_WARNING]);
    const { slice, read } = harness();

    await slice.loadProviderLimits();

    expect(read().providerLimits).toEqual({ anthropic: WEEKLY_WARNING });
  });

  it('merges a new Claude event with the window it already knew and saves it', async () => {
    const { slice, read } = harness();

    await slice.recordProviderLimits({ limits: WEEKLY_WARNING });
    await slice.recordProviderLimits({ limits: FIVE_HOUR_OK });

    const saved = read().providerLimits as Record<string, ProviderLimits>;
    expect(saved.anthropic?.status).toBe('warning');
    expect(saved.anthropic?.windows.map((window) => window.kind)).toEqual(['fiveHour', 'weekly']);
    expect(upsertSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ limits: saved.anthropic }),
    );
  });

  it('ignores an observation older than the one it holds', async () => {
    const { slice, read } = harness();

    await slice.recordProviderLimits({ limits: FIVE_HOUR_OK });
    await slice.recordProviderLimits({ limits: WEEKLY_WARNING });

    expect((read().providerLimits as Record<string, ProviderLimits>).anthropic).toEqual(
      FIVE_HOUR_OK,
    );
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });

  it('reads codex limits and free resets from the app server', async () => {
    invokeSpy.mockImplementation(async (command: string) =>
      command === 'codex_rate_limits_probe'
        ? {
            rateLimitsByLimitId: {
              codex: {
                primary: { usedPercent: 100, windowDurationMins: 300, resetsAt: 4070937600 },
                secondary: { usedPercent: 40, windowDurationMins: 10080, resetsAt: 4071024000 },
                planType: 'plus',
                rateLimitReachedType: 'primary',
              },
            },
            rateLimitResetCredits: {
              availableCount: 1,
              credits: [{ id: 'credit-1', status: 'available', expiresAt: 4071024000 }],
            },
          }
        : null,
    );
    const { slice, read } = harness();

    await slice.refreshCodexLimits({ withResetDetails: true });

    expect(invokeSpy).toHaveBeenCalledWith('codex_rate_limits_probe', {
      includeResetCreditDetails: true,
    });
    expect(invokeSpy).not.toHaveBeenCalledWith('codex_rate_limits_latest');
    expect((read().providerLimits as Record<string, ProviderLimits>).codex).toMatchObject({
      plan: 'Plus',
      status: 'reached',
    });
    expect(read().codexResetCredits).toMatchObject({ availableCount: 1, creditId: 'credit-1' });
    expect(read().providerLimitsProbe).toMatchObject({
      codex: { isChecking: false, failures: 0 },
    });
  });

  it('keeps the credit details a background poll skipped', async () => {
    const withCredits = (credits: unknown) => ({
      rateLimits: {
        primary: { usedPercent: 10, windowDurationMins: 300, resetsAt: 4070937600 },
        planType: 'plus',
      },
      rateLimitResetCredits: { availableCount: 1, credits },
    });
    invokeSpy.mockResolvedValueOnce(
      withCredits([{ id: 'credit-1', status: 'available', expiresAt: 4071024000 }]),
    );
    const { slice, read } = harness();
    await slice.refreshCodexLimits({ withResetDetails: true });

    invokeSpy.mockResolvedValueOnce(withCredits(null));
    await slice.refreshCodexLimits();

    expect(read().codexResetCredits).toMatchObject({ availableCount: 1, creditId: 'credit-1' });
  });

  it('falls back to the latest Codex rollout when the app server fails', async () => {
    invokeSpy.mockImplementation(async (command: string) => {
      if (command === 'codex_rate_limits_probe') {
        throw new Error('spawn failed');
      }
      return {
        observedAt: '2099-01-01T10:59:20.919Z',
        rateLimits: {
          primary: { used_percent: 12, window_minutes: 300, resets_at: 4070937600 },
          secondary: { used_percent: 100, window_minutes: 10080, resets_at: 4071024000 },
          plan_type: 'plus',
        },
      };
    });
    const { slice, read } = harness();

    await slice.refreshCodexLimits();

    expect(invokeSpy).toHaveBeenCalledWith('codex_rate_limits_latest');
    expect((read().providerLimits as Record<string, ProviderLimits>).codex).toMatchObject({
      plan: 'Plus',
      status: 'reached',
    });
    expect(read().providerLimitsProbe).toMatchObject({ codex: { failures: 1 } });
  });

  it('keeps quiet when Codex never wrote a rollout', async () => {
    invokeSpy.mockResolvedValue(null);
    const { slice, read } = harness();

    await slice.refreshCodexLimits();

    expect(read().providerLimits).toEqual({});
  });

  it('probes claude usage through the backend and records the parsed windows', async () => {
    invokeSpy.mockResolvedValue({
      stdout: JSON.stringify({
        result: 'Current session: 4% used · resets Sep 26 at 7:40am (Europe/Rome)',
      }),
      stderr: '',
    });
    const { slice, read } = harness();

    await slice.refreshClaudeUsage();

    expect(invokeSpy).toHaveBeenCalledWith('claude_usage_probe');
    expect((read().providerLimits as Record<string, ProviderLimits>).anthropic).toMatchObject({
      providerId: 'anthropic',
      windows: [expect.objectContaining({ kind: 'fiveHour', usedFraction: 0.04 })],
    });
  });

  it('skips the claude usage probe when the CLI is known to be signed out', async () => {
    const { slice, read } = harness();
    (read() as { authResults: unknown }).authResults = {
      anthropic: { state: 'disconnected', identity: null },
    };

    await slice.refreshClaudeUsage();

    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it('probes both claude and codex together', async () => {
    invokeSpy.mockResolvedValue(null);
    const { slice } = harness();

    await slice.probeProviderLimits();

    expect(invokeSpy).toHaveBeenCalledWith('claude_usage_probe');
    expect(invokeSpy).toHaveBeenCalledWith('codex_rate_limits_probe', {
      includeResetCreditDetails: false,
    });
    expect(invokeSpy).toHaveBeenCalledWith('codex_rate_limits_latest');
  });
  it('retries a failed reset with the same attempt key and clears it on the answer', async () => {
    invokeSpy.mockRejectedValueOnce(new Error('offline'));
    const { slice, read } = harness();

    expect(await slice.consumeCodexResetCredit()).toBe('failed');
    const firstKey = (read().codexPendingReset as { idempotencyKey: string }).idempotencyKey;

    invokeSpy.mockImplementation(async (command: string) =>
      command === 'codex_consume_reset_credit' ? { outcome: 'alreadyRedeemed' } : null,
    );
    expect(await slice.consumeCodexResetCredit()).toBe('reset');

    const consumeCalls = invokeSpy.mock.calls.filter(
      ([command]) => command === 'codex_consume_reset_credit',
    );
    expect(consumeCalls.map(([, args]) => args)).toEqual([
      { idempotencyKey: firstKey },
      { idempotencyKey: firstKey },
    ]);
    expect(read().codexPendingReset).toBeNull();
    expect(invokeSpy).toHaveBeenCalledWith('codex_rate_limits_probe', {
      includeResetCreditDetails: true,
    });
  });

  it('drops the reset row when codex says no credit is left', async () => {
    invokeSpy.mockResolvedValue({ outcome: 'noCredit' });
    const { slice, read } = harness();
    (read() as { codexResetCredits: unknown }).codexResetCredits = {
      availableCount: 1,
      creditId: 'credit-1',
      expiresAt: null,
      observedAt: '2099-01-01T09:00:00.000Z',
    };

    expect(await slice.consumeCodexResetCredit()).toBe('noCredit');
    expect(read().codexResetCredits).toMatchObject({ availableCount: 0 });
  });
});
