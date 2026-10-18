// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderConnectionState, ProviderLimits } from '@goodboy/types';
import { isoDateTimeOf } from '../../__tests__/helpers/brandedIds';
import type { ProviderDisplayInfo } from './providers';
import { providerAccountChip } from './providerAccountChip';
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

const NOW = Date.UTC(2026, 8, 25, 12, 0);
const iso = (hours: number): IsoDateTime =>
  isoDateTimeOf({ value: new Date(Date.UTC(2026, 8, 25, hours, 0)).toISOString() });

const NEARLY_OUT: ProviderLimits = {
  providerId: 'anthropic',
  plan: null,
  status: 'warning',
  windows: [
    { kind: 'fiveHour', model: null, status: 'warning', usedFraction: 0.9, resetsAt: iso(14) },
  ],
  observedAt: iso(11),
};

describe('providerAccountChip', () => {
  it('says Working for a connected provider', () => {
    expect(providerAccountChip({ provider: provider({ connection: 'connected' }), state })).toEqual(
      { label: 'Working', tone: 'success', isSignInNeeded: false },
    );
  });

  it('keeps Working while the rail dot warns about a window that is nearly used up', () => {
    const params = {
      provider: provider({ connection: 'connected' }),
      state: { ...state, providerLimits: { anthropic: NEARLY_OUT } },
      nowMs: NOW,
    };

    expect(providerRailStatus(params).tone).toBe('warning');
    expect(providerAccountChip(params)?.label).toBe('Working');
  });

  it('shares the word of the rail for a problem with the sign-in', () => {
    const params = { provider: provider({ connection: 'installed_disconnected' }), state };

    expect(providerAccountChip(params)).toEqual({
      label: providerRailStatus(params).subtitle,
      tone: 'warning',
      isSignInNeeded: true,
    });
  });

  it('shares the word of the rail for an old CLI', () => {
    expect(
      providerAccountChip({
        provider: provider({ connection: 'connected', version: '0.0.1' }),
        state,
      }),
    ).toEqual({ label: 'Update needed', tone: 'warning', isSignInNeeded: false });
  });

  it('shows no chip while the connection is unknown', () => {
    expect(
      providerAccountChip({ provider: provider({ connection: 'unknown' }), state }),
    ).toBeNull();
  });
});
