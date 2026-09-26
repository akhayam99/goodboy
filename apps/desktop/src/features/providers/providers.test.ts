import { describe, expect, it } from 'vitest';
import type { ProviderId } from '@goodboy/types';
import {
  buildProviderList,
  connectionForApiProvider,
  type ProviderStatus,
  type ProviderStatuses,
} from './providers';

type Params = {
  readonly available: boolean;
};

const runtimeStatus = ({ available }: Params): ProviderStatus => ({
  id: 'opencode',
  binary: 'opencode',
  available,
  version: available ? '1.14.48' : null,
  error: available ? null : 'not found',
});

const statusesFor = ({ available }: Params): ProviderStatuses => ({
  anthropic: null,
  cursor: null,
  codex: null,
  gemini: null,
  opencode: runtimeStatus({ available }),
  openrouter: { ...runtimeStatus({ available }), id: 'openrouter' },
  moonshot: { ...runtimeStatus({ available }), id: 'moonshot' },
});

describe('OpenRouter provider connection', () => {
  it('requires both the OpenCode runtime and a stored credential', () => {
    expect(
      connectionForApiProvider({
        status: runtimeStatus({ available: false }),
        hasCredential: true,
      }),
    ).toBe('missing');
    expect(
      connectionForApiProvider({
        status: runtimeStatus({ available: true }),
        hasCredential: false,
      }),
    ).toBe('installed_disconnected');
    expect(
      connectionForApiProvider({ status: runtimeStatus({ available: true }), hasCredential: true }),
    ).toBe('connected');
  });

  it('builds OpenRouter as linked from credential provider ids', () => {
    const providers = buildProviderList(
      statusesFor({ available: true }),
      {},
      new Set<ProviderId>(['openrouter']),
    );
    const openrouter = providers.find((provider) => provider.id === 'openrouter');
    expect(openrouter?.connection).toBe('connected');
    expect(openrouter?.binary).toBe('opencode');
    expect(openrouter?.version).toBe('1.14.48');
  });
});

describe('Moonshot provider connection', () => {
  it("builds Moonshot as linked from its own credential, not OpenRouter's", () => {
    const providers = buildProviderList(
      statusesFor({ available: true }),
      {},
      new Set<ProviderId>(['moonshot']),
    );
    const moonshot = providers.find((provider) => provider.id === 'moonshot');
    const openrouter = providers.find((provider) => provider.id === 'openrouter');
    expect(moonshot?.connection).toBe('connected');
    expect(moonshot?.binary).toBe('opencode');
    expect(openrouter?.connection).toBe('installed_disconnected');
  });
});

describe('undetected providers', () => {
  it('reports an unknown API provider connection regardless of credentials', () => {
    expect(connectionForApiProvider({ status: null, hasCredential: true })).toBe('unknown');
    expect(connectionForApiProvider({ status: null, hasCredential: false })).toBe('unknown');
  });

  it('reports unknown connections across undetected provider types', () => {
    const providers = buildProviderList({
      anthropic: null,
      cursor: null,
      codex: null,
      gemini: null,
      opencode: null,
      openrouter: null,
      moonshot: null,
    });
    const anthropic = providers.find((provider) => provider.id === 'anthropic');
    const cursor = providers.find((provider) => provider.id === 'cursor');
    const openrouter = providers.find((provider) => provider.id === 'openrouter');
    expect(anthropic?.connection).toBe('unknown');
    expect(cursor?.connection).toBe('unknown');
    expect(openrouter?.connection).toBe('unknown');
  });

  it('reports a detected unavailable runtime provider as missing', () => {
    const providers = buildProviderList({
      ...statusesFor({ available: true }),
      cursor: { ...runtimeStatus({ available: false }), id: 'cursor' },
    });
    const cursor = providers.find((provider) => provider.id === 'cursor');
    expect(cursor?.connection).toBe('missing');
  });
});

describe('OpenCode provider connection', () => {
  it('counts as connected once installed, with no account needed for the free models', () => {
    const providers = buildProviderList(statusesFor({ available: true }));
    const opencode = providers.find((provider) => provider.id === 'opencode');
    expect(opencode?.connection).toBe('connected');
    expect(opencode?.identity).toBe('Free models');
  });

  it('keeps a real signed-in identity when opencode has one', () => {
    const providers = buildProviderList(statusesFor({ available: true }), {
      opencode: { state: 'connected', identity: 'jane@example.com' },
    });
    const opencode = providers.find((provider) => provider.id === 'opencode');
    expect(opencode?.connection).toBe('connected');
    expect(opencode?.identity).toBe('jane@example.com');
  });

  it('is missing when opencode is not installed', () => {
    const providers = buildProviderList(statusesFor({ available: false }));
    const opencode = providers.find((provider) => provider.id === 'opencode');
    expect(opencode?.connection).toBe('missing');
  });
});

describe('Gemini provider connection', () => {
  it('counts a saved API key as connected even with no Antigravity sign-in', () => {
    const providers = buildProviderList(
      {
        ...statusesFor({ available: true }),
        gemini: { id: 'gemini', binary: 'agy', available: true, version: '1.0.0', error: null },
      },
      { gemini: { state: 'disconnected', identity: null } },
      new Set<ProviderId>(['gemini']),
    );
    const gemini = providers.find((provider) => provider.id === 'gemini');
    expect(gemini?.connection).toBe('connected');
  });

  it('stays disconnected with no key and no Antigravity sign-in', () => {
    const providers = buildProviderList(
      {
        ...statusesFor({ available: true }),
        gemini: { id: 'gemini', binary: 'agy', available: true, version: '1.0.0', error: null },
      },
      { gemini: { state: 'disconnected', identity: null } },
    );
    const gemini = providers.find((provider) => provider.id === 'gemini');
    expect(gemini?.connection).toBe('installed_disconnected');
  });

  it('an Antigravity sign-in alone still counts as connected without a key', () => {
    const providers = buildProviderList(
      {
        ...statusesFor({ available: true }),
        gemini: { id: 'gemini', binary: 'agy', available: true, version: '1.0.0', error: null },
      },
      { gemini: { state: 'connected', identity: 'a@example.com' } },
    );
    const gemini = providers.find((provider) => provider.id === 'gemini');
    expect(gemini?.connection).toBe('connected');
  });
});
