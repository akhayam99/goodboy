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
