import { describe, expect, it } from 'vitest';
import type { BudgetAlert, IsoDateTime, ProviderId, SessionId } from '@goodboy/types';
import type { ProviderInfo } from '../providers/providers';
import { workflowAvailabilitySnapshot } from './workflowAvailabilitySnapshot';

const SESSION_ID = 'session-1' as SessionId;
const NOW = 1_000_000;

const provider = (id: ProviderId, connection: string): ProviderInfo =>
  ({ id, connection, label: id, error: null, docsUrl: '' }) as unknown as ProviderInfo;

const alert = (overrides: Partial<BudgetAlert>): BudgetAlert => ({
  id: 'alert-1',
  kind: 'provider-exceeded',
  currentUsd: 10,
  capUsd: 5,
  createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
  ...overrides,
});

const snapshot = (overrides: Partial<Parameters<typeof workflowAvailabilitySnapshot>[0]> = {}) =>
  workflowAvailabilitySnapshot({
    providers: [provider('anthropic', 'connected'), provider('codex', 'connected')],
    cooldowns: {},
    alerts: [],
    sessionId: SESSION_ID,
    isRunBudgetBlocked: false,
    nowMs: NOW,
    ...overrides,
  });

describe('workflowAvailabilitySnapshot', () => {
  it('counts only the providers that are actually connected', () => {
    const result = snapshot({
      providers: [provider('anthropic', 'connected'), provider('codex', 'missing')],
    });

    expect(result.connectedProviders).toEqual(['anthropic']);
  });

  it('reads a cooldown that is still open and ignores one that expired', () => {
    const result = snapshot({ cooldowns: { codex: NOW + 1000, anthropic: NOW - 1000 } });

    expect(result.coolingDownProviders).toEqual(['codex']);
  });

  it('maps a provider budget stop onto the provider id it belongs to', () => {
    const result = snapshot({ alerts: [alert({ provider: 'openai' })] });

    expect(result.budgetBlockedProviders).toEqual(['codex']);
    expect(result.isSessionBudgetBlocked).toBe(false);
  });

  it('leaves every provider eligible when the exceeded alert was dismissed', () => {
    const result = snapshot({
      alerts: [
        alert({ provider: 'openai', dismissedAt: '2026-01-02T00:00:00.000Z' as IsoDateTime }),
      ],
    });

    expect(result.budgetBlockedProviders).toEqual([]);
  });

  it('blocks the whole session only for this session own exceeded cap', () => {
    const mine = snapshot({
      alerts: [alert({ kind: 'session-exceeded', sessionId: SESSION_ID })],
    });
    const other = snapshot({
      alerts: [alert({ kind: 'session-exceeded', sessionId: 'session-2' as SessionId })],
    });

    expect(mine.isSessionBudgetBlocked).toBe(true);
    expect(other.isSessionBudgetBlocked).toBe(false);
  });

  it('carries the run pause state through untouched', () => {
    expect(snapshot({ isRunBudgetBlocked: true }).isRunBudgetBlocked).toBe(true);
  });
});
