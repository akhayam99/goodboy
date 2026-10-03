import { describe, expect, it } from 'vitest';
import type { AgentRole, AuxTaskId, ProviderId, ProviderPolicy } from '@goodboy/types';
import { ROLE_REGISTRY } from '../../roles';
import { TASKS } from '../../settings/tasks';
import { resolveRoleRouting } from '../role-models';
import { resolveTaskModel } from '../task-models';
import { AUTO_DEFAULTS } from './defaults';
import {
  providerCandidates,
  providerStanding,
  seedProviderPolicy,
  workingProviders,
  type ProviderCandidatesContext,
} from './providerCandidates';
import { resolveAuto, type AutoSlot } from './resolveAuto';

const TASK_IDS: ReadonlySet<string> = new Set(TASKS.map((task) => task.id));

const isTaskId = (id: string): id is AuxTaskId => TASK_IDS.has(id);

const isRole = (id: string): id is AgentRole => id in ROLE_REGISTRY;

const ALL_SLOTS: ReadonlyArray<AutoSlot> = Object.keys(AUTO_DEFAULTS.anthropic).flatMap(
  (id): ReadonlyArray<AutoSlot> => {
    if (isTaskId(id)) {
      return [{ kind: 'task', id }];
    }
    return isRole(id) ? [{ kind: 'role', id }] : [];
  },
);

type Scenario = {
  readonly defaultProvider: ProviderId;
  readonly connected: ReadonlyArray<ProviderId>;
  readonly atLimit: ReadonlyArray<ProviderId>;
};

const SCENARIOS: ReadonlyArray<Scenario> = [
  { defaultProvider: 'anthropic', connected: ['anthropic', 'codex', 'cursor'], atLimit: [] },
  { defaultProvider: 'codex', connected: ['anthropic', 'codex', 'gemini'], atLimit: ['codex'] },
  { defaultProvider: 'cursor', connected: ['cursor', 'opencode', 'anthropic'], atLimit: [] },
  {
    defaultProvider: 'anthropic',
    connected: ['anthropic', 'openrouter', 'moonshot'],
    atLimit: ['anthropic'],
  },
];

const CONTEXT: ProviderCandidatesContext = {
  defaultProvider: 'anthropic',
  connected: ['anthropic', 'codex', 'cursor', 'openrouter'],
  atLimit: [],
};

describe('providerCandidates', () => {
  it('gives the same pick as no policy on every slot when every provider is On', () => {
    for (const scenario of SCENARIOS) {
      const policy = seedProviderPolicy(scenario);
      for (const slot of ALL_SLOTS) {
        expect(resolveAuto({ slot, ...scenario, policy })).toEqual(
          resolveAuto({ slot, ...scenario }),
        );
      }
    }
  });

  it('puts the order of the policy ahead of the curated providers', () => {
    const policy: ProviderPolicy = [
      { id: 'openrouter', state: 'on' },
      { id: 'anthropic', state: 'on' },
    ];

    expect(providerCandidates({ ...CONTEXT, policy })).toEqual(['openrouter', 'anthropic']);
    expect(providerCandidates(CONTEXT)).toEqual(['anthropic', 'cursor', 'codex', 'openrouter']);
  });

  it('never offers an Off provider, even the default one', () => {
    const policy: ProviderPolicy = [
      { id: 'anthropic', state: 'off' },
      { id: 'codex', state: 'on' },
    ];

    expect(providerCandidates({ ...CONTEXT, policy })).toEqual(['codex']);
    expect(
      resolveAuto({ slot: { kind: 'role', id: 'implementer' }, ...CONTEXT, policy })?.provider,
    ).toBe('codex');
  });

  it('reaches a Backup only provider only when no On provider can work', () => {
    const policy: ProviderPolicy = [
      { id: 'codex', state: 'on' },
      { id: 'cursor', state: 'backup' },
    ];
    const slot: AutoSlot = { kind: 'role', id: 'implementer' };

    expect(resolveAuto({ slot, ...CONTEXT, policy })?.provider).toBe('codex');
    expect(resolveAuto({ slot, ...CONTEXT, atLimit: ['codex'], policy })?.provider).toBe('cursor');
    expect(
      resolveAuto({ slot, ...CONTEXT, connected: ['anthropic', 'cursor'], policy })?.provider,
    ).toBe('cursor');
  });

  it('keeps an On provider at its limit when it is marked to keep going', () => {
    const policy: ProviderPolicy = [
      { id: 'codex', state: 'on', keepAfterLimit: true },
      { id: 'cursor', state: 'backup' },
    ];

    expect(providerCandidates({ ...CONTEXT, atLimit: ['codex'], policy })).toEqual([
      'codex',
      'cursor',
    ]);
  });

  it('treats a provider missing from the policy as not used', () => {
    const policy: ProviderPolicy = [{ id: 'codex', state: 'on' }];

    expect(providerCandidates({ ...CONTEXT, policy })).toEqual(['codex']);
  });
});

describe('a pin on an Off provider', () => {
  const policy: ProviderPolicy = [
    { id: 'anthropic', state: 'on' },
    { id: 'cursor', state: 'off' },
  ];

  it('never runs a role there and falls back to Auto', () => {
    const routing = resolveRoleRouting({
      role: 'reviewer',
      prefs: { reviewer: { providerId: 'cursor', model: 'composer-2', effort: 'medium' } },
      auto: { ...CONTEXT, policy },
    });

    expect(routing.provider).toBe('anthropic');
    expect(routing.pinnedUnavailable?.provider).toBe('cursor');
  });

  it('never runs a background task there and falls back to Auto', () => {
    const task = resolveTaskModel({
      task: 'summarizer',
      preferences: { summarizer: { providerId: 'cursor', model: 'composer-2' } },
      workspaceDefaultProviderId: 'anthropic',
      sessionDefaultProviderId: 'anthropic',
      connectedProviders: CONTEXT.connected ?? null,
      providerPolicy: policy,
    });

    expect(task.providerId).toBe('anthropic');
  });
});

describe('workingProviders', () => {
  const policy: ProviderPolicy = [
    { id: 'codex', state: 'on' },
    { id: 'anthropic', state: 'on' },
    { id: 'cursor', state: 'backup' },
    { id: 'openrouter', state: 'off' },
  ];

  it('keeps every provider while no policy is saved', () => {
    expect(workingProviders(CONTEXT)).toBeNull();
  });

  it('starts new work on the On providers, in order, and drops backup and Off', () => {
    expect(workingProviders({ ...CONTEXT, policy })).toEqual(['codex', 'anthropic']);
  });

  it('falls back to the backup providers once no On provider can work', () => {
    expect(workingProviders({ ...CONTEXT, atLimit: ['codex', 'anthropic'], policy })).toEqual([
      'cursor',
    ]);
  });
});

describe('providerStanding', () => {
  const policy: ProviderPolicy = [
    { id: 'anthropic', state: 'on' },
    { id: 'codex', state: 'on' },
    { id: 'cursor', state: 'backup' },
    { id: 'gemini', state: 'off' },
  ];
  const context: ProviderCandidatesContext = {
    defaultProvider: 'anthropic',
    connected: ['anthropic', 'codex', 'cursor', 'gemini'],
    atLimit: ['codex'],
    policy,
  };

  it('names why each provider can or cannot take new work', () => {
    expect(providerStanding({ provider: 'anthropic', context })).toBe('usable');
    expect(providerStanding({ provider: 'codex', context })).toBe('at-limit');
    expect(providerStanding({ provider: 'cursor', context })).toBe('backup');
    expect(providerStanding({ provider: 'gemini', context })).toBe('off');
    expect(providerStanding({ provider: 'opencode', context })).toBe('not-connected');
  });
});
