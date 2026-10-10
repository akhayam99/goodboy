// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderConnectionState, ProviderLimits } from '@goodboy/types';
import {
  INITIAL_EVIDENCE,
  INITIAL_HEALTH,
  INITIAL_HEALTH_MAP,
} from '../../store/slices/providers/providerHealth';
import type { ProviderDisplayInfo } from './providers';
import { providerRailStatus } from './providerRailStatus';

const state = { cliRequirements: [] } as const;

const provider = ({
  connection,
  version = '99.0.0',
  extra = {},
}: {
  readonly connection: ProviderConnectionState;
  readonly version?: string;
  readonly extra?: Partial<ProviderDisplayInfo>;
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
  ...extra,
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

  describe('when the provider reports limits', () => {
    const NOW = Date.UTC(2026, 8, 25, 12, 0);
    const iso = (hours: number): IsoDateTime =>
      new Date(Date.UTC(2026, 8, 25, hours, 0)).toISOString() as IsoDateTime;
    const limits = (usedFraction: number): ProviderLimits => ({
      providerId: 'anthropic',
      plan: null,
      status: usedFraction >= 1 ? 'reached' : 'warning',
      windows: [
        {
          kind: 'fiveHour',
          model: null,
          status: usedFraction >= 1 ? 'reached' : 'warning',
          usedFraction,
          resetsAt: iso(14),
        },
      ],
      observedAt: iso(11),
    });

    it('flags a connected provider that is about to run out', () => {
      expect(
        providerRailStatus({
          provider: provider({ connection: 'connected' }),
          state: { ...state, providerLimits: { anthropic: limits(0.9) } },
          nowMs: NOW,
        }),
      ).toEqual({ subtitle: 'Claude is about to run out', tone: 'warning' });
    });

    it('flags a connected provider that is out', () => {
      expect(
        providerRailStatus({
          provider: provider({ connection: 'connected' }),
          state: { ...state, providerLimits: { anthropic: limits(1) } },
          nowMs: NOW,
        }),
      ).toEqual({ subtitle: 'Claude is out', tone: 'warning' });
    });

    it('leaves a provider that is not signed in with its own word', () => {
      expect(
        providerRailStatus({
          provider: provider({ connection: 'installed_disconnected' }),
          state: { ...state, providerLimits: { anthropic: limits(1) } },
          nowMs: NOW,
        }),
      ).toEqual({ subtitle: 'Not signed in', tone: 'warning' });
    });
  });

  describe('with evidence behind the standing', () => {
    it('says Signed out for a provider whose sign-in was confirmed lost', () => {
      expect(
        providerRailStatus({
          provider: provider({
            connection: 'installed_disconnected',
            extra: { standing: 'signed_out' },
          }),
          state,
        }),
      ).toEqual({ subtitle: 'Signed out', tone: 'warning' });
    });

    it("says Can't check, muted, for a provider that stopped answering", () => {
      expect(
        providerRailStatus({
          provider: provider({ connection: 'connected', extra: { standing: 'cannot_check' } }),
          state,
        }),
      ).toEqual({ subtitle: "Can't check", tone: 'neutral' });
    });

    it("says Can't check for a provider that stopped answering before it was ever confirmed", () => {
      expect(
        providerRailStatus({ provider: provider({ connection: 'cannot_check' }), state }),
      ).toEqual({ subtitle: "Can't check", tone: 'neutral' });
    });

    it('says Refused your runs while the breaker is open, whatever the probe says', () => {
      expect(
        providerRailStatus({
          provider: provider({
            connection: 'connected',
            extra: { standing: 'connected', isBreakerOpen: true },
          }),
          state,
        }),
      ).toEqual({ subtitle: 'Refused your runs', tone: 'warning' });
    });

    it('says Not confirmed, muted, when only local tokens vouch for the sign-in', () => {
      const health = {
        ...INITIAL_HEALTH_MAP,
        anthropic: {
          ...INITIAL_HEALTH,
          standing: 'connected' as const,
          evidence: { ...INITIAL_EVIDENCE, localTokens: true, serverAccepted: false },
        },
      };
      expect(
        providerRailStatus({
          provider: provider({ connection: 'connected', extra: { standing: 'connected' } }),
          state: { ...state, providerHealth: health },
        }),
      ).toEqual({ subtitle: 'Not confirmed', tone: 'neutral' });
    });

    it('says nothing once the server confirmed the sign-in', () => {
      const health = {
        ...INITIAL_HEALTH_MAP,
        anthropic: {
          ...INITIAL_HEALTH,
          standing: 'connected' as const,
          evidence: { ...INITIAL_EVIDENCE, localTokens: true, serverAccepted: true },
        },
      };
      expect(
        providerRailStatus({
          provider: provider({ connection: 'connected', extra: { standing: 'connected' } }),
          state: { ...state, providerHealth: health },
        }),
      ).toEqual({ subtitle: undefined, tone: undefined });
    });
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
