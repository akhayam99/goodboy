// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ProviderConnectionState } from '@goodboy/types';
import type { ProviderDisplayInfo } from './providers';
import { providerRailStatus } from './providerRailStatus';

const state = { cliRequirements: [] } as const;

const provider = ({
  connection,
  version = '99.0.0',
}: {
  readonly connection: ProviderConnectionState;
  readonly version?: string;
}): ProviderDisplayInfo => ({
  id: 'anthropic',
  binary: 'claude',
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection,
  version,
  identity: 'ada@harborline.dev',
  label: 'Claude',
  error: null,
  docsUrl: '',
});

describe('providerRailStatus', () => {
  it('says nothing for a connected provider, with no identity and no tone', () => {
    expect(providerRailStatus({ provider: provider({ connection: 'connected' }), state })).toEqual({
      subtitle: undefined,
      tone: undefined,
    });
  });

  it('flags a connected provider whose CLI is too old', () => {
    expect(
      providerRailStatus({
        provider: provider({ connection: 'connected', version: '0.0.1' }),
        state,
      }),
    ).toEqual({ subtitle: 'Update needed', tone: 'warning' });
  });

  it.each([
    ['installed_disconnected', { subtitle: 'Not signed in', tone: 'warning' }],
    ['error', { subtitle: 'Error', tone: 'danger' }],
    ['missing', { subtitle: 'Not connected', tone: undefined }],
    ['unknown', { subtitle: undefined, tone: undefined }],
  ] as const)('maps %s to its one-word status', (connection, expected) => {
    expect(providerRailStatus({ provider: provider({ connection }), state })).toEqual(expected);
  });
});
