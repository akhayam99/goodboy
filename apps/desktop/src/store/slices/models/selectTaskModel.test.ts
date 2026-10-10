// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { getCapabilities } from '@goodboy/core';
import type { ProviderId, ProviderLimits, ProviderPolicy } from '@goodboy/types';
import { EMPTY_OVERRIDES, aSession, aWorkspace } from '@goodboy/types/testing';
import type { ProviderDisplayInfo } from '../../../features/providers/providers';
import { useAppStore } from '../../store';
import { selectTaskModel } from './selectTaskModel';

const WORKSPACE = aWorkspace({ name: 'Northwind' });
const SESSION = aSession({
  workspaceId: WORKSPACE.id,
  providerPreference: { defaultProvider: 'codex', allowTurnOverride: true },
});

type ProviderParams = {
  readonly id: ProviderId;
};

const connectedProvider = ({ id }: ProviderParams): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: getCapabilities({ id }),
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

const BOTH_ON: ProviderPolicy = [
  { id: 'codex', state: 'on' },
  { id: 'anthropic', state: 'on' },
];

const CODEX_LIMIT: Partial<Record<ProviderId, ProviderLimits>> = JSON.parse(
  JSON.stringify({
    codex: {
      providerId: 'codex',
      plan: null,
      status: 'reached',
      windows: [
        {
          kind: 'fiveHour',
          model: null,
          status: 'reached',
          usedFraction: 1,
          resetsAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
      ],
      observedAt: new Date().toISOString(),
    },
  }),
);

type SeedParams = {
  readonly policy: ProviderPolicy;
  readonly taskModels?: typeof EMPTY_OVERRIDES.taskModels;
  readonly limits?: Partial<Record<ProviderId, ProviderLimits>>;
};

const seed = ({ policy, taskModels = null, limits = {} }: SeedParams) =>
  useAppStore.setState({
    workspaces: [WORKSPACE],
    sessions: [SESSION],
    providers: [connectedProvider({ id: 'anthropic' }), connectedProvider({ id: 'codex' })],
    providerLimits: limits,
    workspaceOverrides: {
      [WORKSPACE.id]: { ...EMPTY_OVERRIDES, providerPool: policy, taskModels },
    },
  });

beforeEach(() => {
  useAppStore.setState({ settings: {}, sessions: [], providers: [], providerLimits: {} });
});

describe('selectTaskModel', () => {
  it('runs an Auto task on the default provider', () => {
    seed({ policy: BOTH_ON });

    expect(
      selectTaskModel({
        state: useAppStore.getState(),
        sessionId: SESSION.id,
        task: 'agent_naming',
      }).providerId,
    ).toBe('codex');
  });

  it('keeps a pinned task on its provider', () => {
    seed({
      policy: BOTH_ON,
      taskModels: { agent_naming: { providerId: 'anthropic', model: 'haiku-4.5' } },
    });

    expect(
      selectTaskModel({
        state: useAppStore.getState(),
        sessionId: SESSION.id,
        task: 'agent_naming',
      }),
    ).toMatchObject({ providerId: 'anthropic', model: 'haiku-4.5' });
  });

  it('skips a pin on a provider that is Off and runs Auto on the first On provider', () => {
    seed({
      policy: [
        { id: 'codex', state: 'on' },
        { id: 'anthropic', state: 'off' },
      ],
      taskModels: { agent_naming: { providerId: 'anthropic', model: 'haiku-4.5' } },
    });

    expect(
      selectTaskModel({
        state: useAppStore.getState(),
        sessionId: SESSION.id,
        task: 'agent_naming',
      }).providerId,
    ).toBe('codex');
  });

  it('runs a workspace-scoped task with no session', () => {
    seed({
      policy: [
        { id: 'anthropic', state: 'on' },
        { id: 'codex', state: 'off' },
      ],
    });

    expect(
      selectTaskModel({
        state: useAppStore.getState(),
        workspaceId: WORKSPACE.id,
        task: 'plan_generation',
      }).providerId,
    ).toBe('anthropic');
  });

  it('moves an Auto task to the next provider while the default is out', () => {
    seed({ policy: BOTH_ON, limits: CODEX_LIMIT });

    expect(
      selectTaskModel({
        state: useAppStore.getState(),
        sessionId: SESSION.id,
        task: 'agent_naming',
      }).providerId,
    ).toBe('anthropic');
  });
});
