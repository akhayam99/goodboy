// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId } from '@goodboy/types';
import type {
  IsoDateTime,
  ProviderConnectionState,
  ProviderId,
  ProviderLimits,
} from '@goodboy/types';
import type { ToolCheck } from '../../../store/slices/integrations/state';
import { INITIAL_EVIDENCE, INITIAL_HEALTH } from '../../../store/slices/providers/providerHealth';
import type { ProviderDisplayInfo } from '../../providers/providers';
import { connectionStateOf } from './connectionStateOf';

const NOW = Date.UTC(2026, 10, 15, 12, 0);

type ProviderParams = {
  readonly id?: ProviderId;
  readonly connection: ProviderConnectionState;
  readonly extra?: Partial<ProviderDisplayInfo>;
};

const aProvider = ({ id = 'anthropic', connection, extra = {} }: ProviderParams) => ({
  id,
  binary: 'claude',
  capabilities: { models: [] },
  connection,
  version: '99.0.0',
  identity: 'mara.quint@harborline.dev',
  label: 'Claude',
  error: null,
  docsUrl: '',
  ...extra,
});

type IsoParams = {
  readonly hours: number;
};

const isoAt = ({ hours }: IsoParams): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(Date.UTC(2026, 10, 15, hours, 0)).toISOString() });

type LimitsParams = {
  readonly usedFraction: number;
};

const limitsAt = ({ usedFraction }: LimitsParams): ProviderLimits => ({
  providerId: 'anthropic',
  plan: 'max',
  status: usedFraction >= 1 ? 'reached' : 'warning',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: usedFraction >= 1 ? 'reached' : 'warning',
      usedFraction,
      resetsAt: isoAt({ hours: 17 }),
    },
  ],
  observedAt: isoAt({ hours: 11 }),
});

type ToolParams = {
  readonly isConnected: boolean;
  readonly check: ToolCheck | undefined;
};

type StateParams = ProviderParams & {
  readonly limits?: ProviderLimits;
};

const providerState = ({ limits, ...params }: StateParams) =>
  connectionStateOf({
    subject: {
      kind: 'provider',
      provider: aProvider(params),
      state: {
        cliRequirements: [],
        ...(limits !== undefined && { providerLimits: { anthropic: limits } }),
      },
      nowMs: NOW,
    },
  });

describe('connectionStateOf, a provider', () => {
  it('says Signed in, quiet, for a connected CLI', () => {
    expect(providerState({ connection: 'connected' })).toMatchObject({
      word: 'Signed in',
      tone: null,
      setupVerb: null,
    });
  });

  it('says Key saved for a connected key provider', () => {
    expect(providerState({ id: 'openrouter', connection: 'connected' })).toMatchObject({
      word: 'Key saved',
      tone: null,
    });
  });

  it('asks to install a CLI that is missing', () => {
    expect(providerState({ connection: 'missing' })).toMatchObject({
      word: 'Not set up',
      setupVerb: 'Install CLI',
    });
  });

  it('asks to sign in to a CLI found but never signed in', () => {
    expect(providerState({ connection: 'installed_disconnected' })).toMatchObject({
      setupVerb: 'Sign in',
    });
  });

  it('asks for a key from a key provider that has none', () => {
    expect(providerState({ id: 'moonshot', connection: 'missing' })).toMatchObject({
      setupVerb: 'Add a key',
    });
    expect(providerState({ id: 'moonshot', connection: 'installed_disconnected' })).toMatchObject({
      setupVerb: 'Add a key',
    });
  });

  it('keeps a signed out CLI in the grid with a warning', () => {
    expect(
      providerState({ connection: 'installed_disconnected', extra: { standing: 'signed_out' } }),
    ).toMatchObject({ word: 'Signed out', tone: 'warning', setupVerb: null });
  });

  it('says Checking while the provider is unknown', () => {
    expect(providerState({ connection: 'unknown' })).toMatchObject({
      word: 'Checking',
      isChecking: true,
      setupVerb: null,
    });
  });

  it('says Update needed when the CLI is too old for a model', () => {
    expect(providerState({ connection: 'connected', extra: { version: '0.0.1' } })).toMatchObject({
      word: 'Update needed',
      tone: 'warning',
    });
  });

  it('says Refused your runs while the breaker is open', () => {
    expect(
      providerState({ connection: 'connected', extra: { isBreakerOpen: true } }),
    ).toMatchObject({ word: 'Refused your runs', tone: 'warning' });
  });

  it("says Can't check, quiet, for a provider that stopped answering", () => {
    expect(
      providerState({ connection: 'connected', extra: { standing: 'cannot_check' } }),
    ).toMatchObject({ word: "Can't check", tone: null });
  });

  it('says Error in red with the reason for a failed probe', () => {
    expect(
      providerState({ connection: 'error', extra: { error: 'claude exited with 1' } }),
    ).toMatchObject({ word: 'Error', tone: 'danger', reason: 'claude exited with 1' });
  });

  it('says Not confirmed, quiet, until the server accepts a run', () => {
    const state = connectionStateOf({
      subject: {
        kind: 'provider',
        provider: aProvider({ connection: 'connected' }),
        state: {
          cliRequirements: [],
          providerHealth: {
            anthropic: {
              ...INITIAL_HEALTH,
              standing: 'connected',
              evidence: { ...INITIAL_EVIDENCE, serverAccepted: false },
            },
          },
        },
        nowMs: NOW,
      },
    });

    expect(state).toMatchObject({ word: 'Not confirmed', tone: null });
  });

  it('warns when a window is about to run out', () => {
    expect(
      providerState({ connection: 'connected', limits: limitsAt({ usedFraction: 0.85 }) }),
    ).toMatchObject({ word: 'About to run out', tone: 'warning' });
  });

  it('says until when the provider is out', () => {
    const state = providerState({ connection: 'connected', limits: limitsAt({ usedFraction: 1 }) });

    expect(state.word).toMatch(/^Out until /);
    expect(state).toMatchObject({ tone: 'warning', reason: 'Claude is out' });
  });
});

describe('connectionStateOf, a tool', () => {
  const toolState = ({ isConnected, check }: ToolParams) =>
    connectionStateOf({ subject: { kind: 'tool', isConnected, check } });

  it('asks to connect a tool that is not connected', () => {
    expect(toolState({ isConnected: false, check: undefined })).toMatchObject({
      word: 'Not set up',
      setupVerb: 'Connect',
    });
  });

  it('says Connected, quiet, before and after a good check', () => {
    expect(toolState({ isConnected: true, check: undefined })).toMatchObject({
      word: 'Connected',
      tone: null,
    });
    expect(
      toolState({
        isConnected: true,
        check: { result: 'ok', checkedAtMs: NOW, isChecking: false },
      }),
    ).toMatchObject({ word: 'Connected', tone: null });
  });

  it('says Key missing in red when the keychain lost the key', () => {
    expect(
      toolState({
        isConnected: true,
        check: { result: 'key-missing', checkedAtMs: NOW, isChecking: false },
      }),
    ).toMatchObject({ word: 'Key missing', tone: 'danger', reason: 'Key missing on this Mac' });
  });

  it("says Can't check after a failed check", () => {
    expect(
      toolState({
        isConnected: true,
        check: { result: 'failed', checkedAtMs: NOW, isChecking: false },
      }),
    ).toMatchObject({ word: "Can't check", tone: null });
  });

  it('says Checking while a check runs', () => {
    expect(
      toolState({
        isConnected: true,
        check: { result: 'key-missing', checkedAtMs: NOW, isChecking: true },
      }),
    ).toMatchObject({ word: 'Checking', isChecking: true });
  });
});
