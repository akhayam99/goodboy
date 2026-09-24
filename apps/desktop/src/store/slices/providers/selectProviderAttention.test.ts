import { describe, expect, it } from 'vitest';
import type { ProviderConnectionState, ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../features/providers/providers';
import { selectProviderAttention } from './selectProviderAttention';

type ProviderParams = {
  readonly id: ProviderId;
  readonly connection: ProviderConnectionState;
  readonly version: string | null;
};

const provider = ({ id, connection, version }: ProviderParams): ProviderDisplayInfo =>
  ({
    id,
    label: id,
    binary: id,
    version,
    connection,
    identity: null,
    error: null,
    docsUrl: 'https://example.test',
  }) as unknown as ProviderDisplayInfo;

const attention = (providers: ReadonlyArray<ProviderDisplayInfo>) =>
  selectProviderAttention({ state: { providers, cliRequirements: [] } });

describe('selectProviderAttention', () => {
  it('names the one CLI that is too old for a model it serves', () => {
    expect(
      attention([
        provider({ id: 'anthropic', connection: 'connected', version: '2.1.200' }),
        provider({ id: 'codex', connection: 'connected', version: '1.0.0' }),
      ]),
    ).toBe('Claude CLI needs an update');
  });

  it('counts CLIs when more than one is behind', () => {
    const state = {
      providers: [
        provider({ id: 'anthropic', connection: 'connected', version: '2.1.200' }),
        provider({ id: 'codex', connection: 'connected', version: '1.0.0' }),
      ],
      cliRequirements: [{ providerId: 'codex', modelKey: 'gpt-6', requiredVersion: '2.0.0' }],
    } as const;
    expect(selectProviderAttention({ state })).toBe('2 CLIs need an update');
  });

  it('says nothing while the version or the connection is unknown', () => {
    expect(
      attention([provider({ id: 'anthropic', connection: 'connected', version: null })]),
    ).toBeNull();
    expect(
      attention([provider({ id: 'anthropic', connection: 'unknown', version: null })]),
    ).toBeNull();
    expect(attention([])).toBeNull();
  });

  it('asks for a provider when none is connected', () => {
    expect(
      attention([
        provider({ id: 'anthropic', connection: 'installed_disconnected', version: '2.1.300' }),
        provider({ id: 'codex', connection: 'missing', version: null }),
      ]),
    ).toBe('No provider connected');
  });

  it('stays quiet when every connected CLI meets its models', () => {
    expect(
      attention([
        provider({ id: 'anthropic', connection: 'connected', version: '2.1.300' }),
        provider({ id: 'codex', connection: 'missing', version: null }),
      ]),
    ).toBeNull();
  });
});
