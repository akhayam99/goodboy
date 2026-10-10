// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  BudgetAlert,
  IsoDateTime,
  ProviderId,
  ProviderPolicy,
  SessionId,
} from '@goodboy/types';
import type { ProviderDisplayInfo } from '../providers/providers';
import { orchestratorModelPool } from '@goodboy/core';
import { workflowAvailabilitySnapshot } from './workflowAvailabilitySnapshot';

const SESSION_ID = 'session-1' as SessionId;
const NOW = 1_000_000;

const provider = (id: ProviderId, connection: string): ProviderDisplayInfo =>
  ({ id, connection, label: id, error: null, docsUrl: '' }) as unknown as ProviderDisplayInfo;

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
    hidden: null,
    sessionId: SESSION_ID,
    isRunBudgetBlocked: false,
    nowMs: NOW,
    ...overrides,
  });

describe('workflowAvailabilitySnapshot', () => {
  it('skips a provider whose breaker is open', () => {
    const result = snapshot({
      providers: [
        provider('anthropic', 'connected'),
        { ...provider('cursor', 'connected'), isBreakerOpen: true },
      ],
    });

    expect(result.connectedProviders).toEqual(['anthropic']);
  });

  it('counts only the providers that are actually connected', () => {
    const result = snapshot({
      providers: [provider('anthropic', 'connected'), provider('codex', 'missing')],
    });

    expect(result.connectedProviders).toEqual(['anthropic']);
  });

  it('keeps only the connected providers inside the run pool', () => {
    const result = snapshot({ providerPool: ['codex', 'gemini'] });

    expect(result.connectedProviders).toEqual(['codex']);
  });

  it('drops an Off provider and orders the rest as the workspace policy says', () => {
    const result = snapshot({
      providers: [
        provider('anthropic', 'connected'),
        provider('codex', 'connected'),
        provider('cursor', 'connected'),
      ],
      policy: [
        { id: 'codex', state: 'on' },
        { id: 'anthropic', state: 'on' },
        { id: 'cursor', state: 'off' },
      ],
    });

    expect(result.connectedProviders).toEqual(['codex', 'anthropic']);
    expect(result.providerOrder).toEqual(['codex', 'anthropic']);
  });

  it('offers a Backup only provider once no On provider can work', () => {
    const policy: ProviderPolicy = [
      { id: 'codex', state: 'on' },
      { id: 'anthropic', state: 'backup' },
    ];

    expect(snapshot({ policy }).connectedProviders).toEqual(['codex']);
    expect(snapshot({ policy, atLimit: ['codex'] }).connectedProviders).toEqual(['anthropic']);
  });

  it('treats a missing run pool as every connected provider', () => {
    const result = snapshot({ providerPool: null });

    expect(result.connectedProviders).toEqual(['anthropic', 'codex']);
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

describe('workflowAvailabilitySnapshot spread by headroom', () => {
  const threeConnected = [
    provider('anthropic', 'connected'),
    provider('codex', 'connected'),
    provider('cursor', 'connected'),
  ];

  it('drops a provider that is out and puts a tight one at the end of the menu', () => {
    const result = snapshot({
      providers: threeConnected,
      headroom: { anthropic: 'tight', codex: 'out' },
    });

    expect(result.connectedProviders).toEqual(['cursor', 'anthropic']);
    expect(result.providerOrder).toEqual(['cursor', 'anthropic']);
    expect(
      orchestratorModelPool({ availability: result, hidden: null }).map(
        (option) => option.provider,
      ),
    ).not.toContain('codex');
    expect(orchestratorModelPool({ availability: result, hidden: null }).at(-1)?.provider).toBe(
      'anthropic',
    );
  });

  it('gives back the menu of today when every provider is out', () => {
    const result = snapshot({ headroom: { anthropic: 'out', codex: 'out' } });

    expect(result.connectedProviders).toEqual(['anthropic', 'codex']);
  });

  it('leaves the menu as it is today with the switch off', () => {
    const result = snapshot({ providers: threeConnected });

    expect(result.connectedProviders).toEqual(['anthropic', 'codex', 'cursor']);
    expect(result.providerOrder).toBeUndefined();
  });

  it('carries the hidden models the owner turned off', () => {
    const hidden = { anthropic: ['opus-5'] };

    expect(snapshot({ hidden }).hiddenModels).toEqual(hidden);
    expect(snapshot({ hidden: null }).hiddenModels).toBeUndefined();
  });

  it('keeps a hidden model out of the menu the orchestrator reads', () => {
    const result = snapshot({ hidden: { anthropic: ['opus-5'] } });
    const menu = orchestratorModelPool({ availability: result, hidden: null });

    expect(menu.map((option) => option.model)).not.toContain('opus-5');
  });
});
