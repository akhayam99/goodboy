// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderLimits } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../features/providers/providers';
import { kindRouting } from '../../../features/session/agent-kind';
import { autoLimitContext } from './autoLimitContext';

const NOW_MS = Date.parse('2026-09-25T12:00:00.000Z');

const CLAUDE_OUT: ProviderLimits = {
  providerId: 'anthropic',
  plan: null,
  status: 'reached',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'reached',
      usedFraction: 1,
      resetsAt: '2026-09-25T14:30:00.000Z' as IsoDateTime,
    },
  ],
  observedAt: '2026-09-25T11:50:00.000Z' as IsoDateTime,
};

const providers = [
  { id: 'anthropic', connection: 'connected' },
  { id: 'codex', connection: 'connected' },
  { id: 'cursor', connection: 'missing' },
] as unknown as ReadonlyArray<ProviderDisplayInfo>;

const info = (
  overrides: Partial<ProviderDisplayInfo> & Pick<ProviderDisplayInfo, 'id'>,
): ProviderDisplayInfo => ({
  binary: overrides.id,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection: 'connected',
  version: null,
  identity: null,
  label: overrides.id,
  error: null,
  docsUrl: '',
  ...overrides,
});

describe('autoLimitContext', () => {
  it('stays out of the way while no provider is at its limit', () => {
    expect(
      autoLimitContext({ state: { providers, providerLimits: {} }, nowMs: NOW_MS }),
    ).toBeNull();
  });

  it('hands the ladder the connected providers and the ones at their limit', () => {
    expect(
      autoLimitContext({
        state: { providers, providerLimits: { anthropic: CLAUDE_OUT } },
        nowMs: NOW_MS,
      }),
    ).toEqual({ connected: ['anthropic', 'codex'], atLimit: ['anthropic'] });
  });

  it('moves a new agent off a provider at its limit', () => {
    const limitContext = autoLimitContext({
      state: { providers, providerLimits: { anthropic: CLAUDE_OUT } },
      nowMs: NOW_MS,
    });
    expect(
      kindRouting({ kind: 'generic', defaultProvider: 'anthropic', limitContext }).provider,
    ).toBe('codex');
    expect(kindRouting({ kind: 'generic', defaultProvider: 'anthropic' }).provider).toBe(
      'anthropic',
    );
  });

  it('leaves a provider out of automatic routing while its breaker is open', () => {
    const withBreaker = [info({ id: 'anthropic' }), info({ id: 'cursor', isBreakerOpen: true })];
    expect(
      autoLimitContext({
        state: { providers: withBreaker, providerLimits: { anthropic: CLAUDE_OUT } },
        nowMs: NOW_MS,
      })?.connected,
    ).toEqual(['anthropic']);
  });

  it('keeps counting a cannot check provider that has a last good state as connected', () => {
    const quiet = [info({ id: 'anthropic' }), info({ id: 'cursor', standing: 'cannot_check' })];
    expect(
      autoLimitContext({
        state: { providers: quiet, providerLimits: { anthropic: CLAUDE_OUT } },
        nowMs: NOW_MS,
      })?.connected,
    ).toEqual(['anthropic', 'cursor']);
  });
});
