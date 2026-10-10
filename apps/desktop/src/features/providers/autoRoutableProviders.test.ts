// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveProvider } from '@goodboy/core';
import type { ProviderId, SessionProviderPreference, TurnProviderOverride } from '@goodboy/types';
import { autoRoutableProviders } from './autoRoutableProviders';
import type { ProviderDisplayInfo } from './providers';

const provider = (
  id: ProviderId,
  extra: Partial<ProviderDisplayInfo> = {},
): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
  ...extra,
});

const PROVIDERS = [
  provider('anthropic'),
  provider('cursor', { isBreakerOpen: true, standing: 'connected' }),
  provider('codex', { connection: 'installed_disconnected' }),
];

const PREFERENCE: SessionProviderPreference = {
  defaultProvider: 'cursor',
  allowTurnOverride: true,
};

type RouteParams = {
  readonly pinned: ProviderId | null;
  readonly override?: TurnProviderOverride;
};

const route = ({ pinned, override }: RouteParams) =>
  resolveProvider({
    sessionPreference: PREFERENCE,
    ...(override !== undefined && { turnOverride: override }),
    connectedProviders: autoRoutableProviders({ providers: PROVIDERS, pinned }),
    budgetChecker: {
      checkProviderBudget: async () => ({
        remainingUsd: null,
        pct: 0,
        exceeded: false,
        overThreshold: false,
      }),
    },
    getDefaultModel: (id) => `${id}-default`,
  });

describe('autoRoutableProviders', () => {
  it('leaves out a connected provider whose breaker is open', () => {
    expect(autoRoutableProviders({ providers: PROVIDERS })).toEqual(['anthropic']);
  });

  it('keeps a provider that is pinned by an explicit pick', () => {
    expect(autoRoutableProviders({ providers: PROVIDERS, pinned: 'cursor' })).toEqual([
      'anthropic',
      'cursor',
    ]);
  });

  it('never adds a provider that is not connected, pinned or not', () => {
    expect(autoRoutableProviders({ providers: PROVIDERS, pinned: 'codex' })).toEqual(['anthropic']);
  });

  it('counts a cannot check provider that kept its last good state as connected', () => {
    const quiet = [provider('cursor', { standing: 'cannot_check' })];
    expect(autoRoutableProviders({ providers: quiet })).toEqual(['cursor']);
  });
});

describe('Auto resolution with the breaker open for Cursor', () => {
  it('skips Cursor when it is the default and nothing was picked', async () => {
    const decision = await route({ pinned: null });
    expect(decision.selectedProvider).toBe('anthropic');
    expect(decision.fallbackUsed).toBe(true);
  });

  it('still routes an explicit Cursor pick', async () => {
    const decision = await route({
      pinned: 'cursor',
      override: { providerId: 'cursor', explicit: true },
    });
    expect(decision.selectedProvider).toBe('cursor');
    expect(decision.fallbackUsed).toBe(false);
  });
});
