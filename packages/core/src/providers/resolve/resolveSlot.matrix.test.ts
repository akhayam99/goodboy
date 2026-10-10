import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  EffortLevel,
  ProviderId,
  ProviderPolicy,
  RoleModelPreference,
  TaskModelPreference,
} from '@goodboy/types';
import { TASKS } from '../../settings/tasks';
import { ROLE_REGISTRY, isAgentRole } from '../../roles';
import { AUTO_DEFAULTS } from '../autoRouting/defaults';
import { resolveSlot } from './resolveSlot';
import type { ResolveContext, ResolveLayer, ResolveSlot } from './types';

const ROLE_SLOTS: ReadonlyArray<ResolveSlot> = Object.keys(ROLE_REGISTRY)
  .filter(isAgentRole)
  .map((id) => ({ kind: 'role', id }));

const TASK_SLOTS: ReadonlyArray<ResolveSlot> = TASKS.map((task) => ({
  kind: 'task',
  id: task.id,
}));

const SLOTS: ReadonlyArray<ResolveSlot> = [...ROLE_SLOTS, ...TASK_SLOTS];

const ON: ProviderPolicy = [
  { id: 'anthropic', state: 'on' },
  { id: 'codex', state: 'on' },
];

const OPUS = { providerId: 'anthropic', model: 'opus-5', effort: 'high' } as const;

const SONNET = { providerId: 'anthropic', model: 'sonnet-5', effort: 'medium' } as const;

const SOL = { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'medium' } as const;

type PinParams = {
  readonly slot: ResolveSlot;
  readonly pin: Readonly<{ providerId: ProviderId; model: string; effort: EffortLevel }>;
  readonly fallback?: Readonly<{ providerId: ProviderId; model: string; effort?: EffortLevel }>;
};

const layerWith = ({ slot, pin, fallback }: PinParams): ResolveLayer => {
  if (slot.kind === 'role') {
    const preference: RoleModelPreference = {
      ...pin,
      ...(fallback !== undefined && { fallback }),
    };
    return { roleModels: { [slot.id]: preference } };
  }
  const preference: TaskModelPreference = {
    ...pin,
    ...(fallback !== undefined && { fallback }),
  };
  return { taskModels: { [slot.id]: preference } };
};

type AutoParams = {
  readonly slot: ResolveSlot;
  readonly provider: 'anthropic' | 'codex';
};

const curated = ({ slot, provider }: AutoParams) => {
  const [first] = AUTO_DEFAULTS[provider][slot.id];
  return {
    model: first?.key,
    effort: first?.effort ?? (slot.kind === 'role' ? 'medium' : null),
  };
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveSlot matrix', () => {
  describe.each(SLOTS.map((slot) => [`${slot.kind} ${slot.id}`, slot] as const))(
    '%s',
    (_name, slot) => {
      it('no pin: Auto on the default provider', () => {
        const resolution = resolveSlot({ slot, context: { policy: ON } });

        expect(resolution).toMatchObject({
          provider: 'anthropic',
          source: 'auto',
          via: 'curated',
          skipped: [],
          ...curated({ slot, provider: 'anthropic' }),
        });
      });

      it('pin on an On provider runs and names its layer', () => {
        const resolution = resolveSlot({
          slot,
          layers: { workspace: layerWith({ slot, pin: OPUS }) },
          context: { policy: ON },
        });

        expect(resolution).toMatchObject({
          provider: 'anthropic',
          model: 'opus-5',
          effort: 'high',
          source: 'workspace',
          via: 'pin',
          skipped: [],
        });
      });

      it('pin on a Backup provider is skipped while an On provider can work', () => {
        const resolution = resolveSlot({
          slot,
          layers: { workspace: layerWith({ slot, pin: OPUS }) },
          context: {
            policy: [
              { id: 'codex', state: 'on' },
              { id: 'anthropic', state: 'backup' },
            ],
          },
        });

        expect(resolution).toMatchObject({ provider: 'codex', source: 'auto' });
        expect(resolution.skipped).toContainEqual({
          source: 'workspace',
          provider: 'anthropic',
          model: 'opus-5',
          reason: 'backup-idle',
        });
      });

      it('pin on a Backup provider runs once the On provider is at its limit', () => {
        const resolution = resolveSlot({
          slot,
          layers: { workspace: layerWith({ slot, pin: OPUS }) },
          context: {
            atLimit: ['codex'],
            policy: [
              { id: 'codex', state: 'on' },
              { id: 'anthropic', state: 'backup' },
            ],
          },
        });

        expect(resolution).toMatchObject({
          provider: 'anthropic',
          model: 'opus-5',
          source: 'workspace',
          via: 'pin',
          skipped: [],
        });
      });

      it('pin on Backup when no On provider can work still runs', () => {
        const resolution = resolveSlot({
          slot,
          layers: { workspace: layerWith({ slot, pin: OPUS }) },
          context: {
            connected: ['anthropic'],
            policy: [
              { id: 'codex', state: 'on' },
              { id: 'anthropic', state: 'backup' },
            ],
          },
        });

        expect(resolution).toMatchObject({
          provider: 'anthropic',
          source: 'workspace',
          via: 'pin',
          skipped: [],
        });
      });

      it('pin on an Off provider is skipped and Auto takes over', () => {
        const resolution = resolveSlot({
          slot,
          layers: { workspace: layerWith({ slot, pin: OPUS }) },
          context: {
            policy: [
              { id: 'anthropic', state: 'off' },
              { id: 'codex', state: 'on' },
            ],
          },
        });

        expect(resolution).toMatchObject({
          provider: 'codex',
          source: 'auto',
          ...curated({ slot, provider: 'codex' }),
        });
        expect(resolution.skipped).toEqual([
          { source: 'workspace', provider: 'anthropic', model: 'opus-5', reason: 'off' },
        ]);
      });

      it('pin on a provider that is not connected is skipped', () => {
        const resolution = resolveSlot({
          slot,
          layers: { workspace: layerWith({ slot, pin: OPUS }) },
          context: { connected: ['codex'], fallbackOrder: ['codex'] },
        });

        expect(resolution).toMatchObject({ provider: 'codex', source: 'auto' });
        expect(resolution.skipped).toContainEqual({
          source: 'workspace',
          provider: 'anthropic',
          model: 'opus-5',
          reason: 'not-connected',
        });
      });

      it('retired model: skipped as unknown, Auto takes over', () => {
        const resolution = resolveSlot({
          slot,
          layers: {
            workspace: layerWith({
              slot,
              pin: { providerId: 'anthropic', model: 'claude-opus-99', effort: 'high' },
            }),
          },
          context: { policy: ON },
        });

        expect(resolution).toMatchObject({ provider: 'anthropic', source: 'auto' });
        expect(resolution.skipped).toEqual([
          {
            source: 'workspace',
            provider: 'anthropic',
            model: 'claude-opus-99',
            reason: 'unknown-model',
          },
        ]);
      });

      it('fallback only usable: the fallback runs as a backup', () => {
        const resolution = resolveSlot({
          slot,
          layers: { workspace: layerWith({ slot, pin: OPUS, fallback: SOL }) },
          context: {
            policy: [
              { id: 'anthropic', state: 'off' },
              { id: 'codex', state: 'on' },
            ],
          },
        });

        expect(resolution).toMatchObject({
          provider: 'codex',
          model: 'gpt-6.1-sol',
          source: 'workspace',
          via: 'backup',
        });
        expect(resolution.skipped).toEqual([
          { source: 'workspace', provider: 'anthropic', model: 'opus-5', reason: 'off' },
        ]);
      });

      it('at its limit: Auto passes the provider and says so', () => {
        const resolution = resolveSlot({
          slot,
          context: { policy: ON, connected: ['anthropic', 'codex'], atLimit: ['anthropic'] },
        });

        expect(resolution).toMatchObject({ provider: 'codex', source: 'auto' });
        expect(resolution.skipped).toContainEqual({
          source: 'auto',
          provider: 'anthropic',
          model: null,
          reason: 'at-limit',
        });
      });

      it('at its limit: a pin on that provider still runs, as it does today', () => {
        const resolution = resolveSlot({
          slot,
          layers: { workspace: layerWith({ slot, pin: OPUS }) },
          context: { policy: ON, connected: ['anthropic', 'codex'], atLimit: ['anthropic'] },
        });

        expect(resolution).toMatchObject({
          provider: 'anthropic',
          model: 'opus-5',
          source: 'workspace',
          skipped: [],
        });
      });

      it('ignores a project key: the workspace pin runs', () => {
        const resolution = resolveSlot({
          slot,
          layers: {
            workspace: layerWith({ slot, pin: OPUS }),
            project: layerWith({ slot, pin: SONNET }),
          },
          context: { policy: ON },
        });

        expect(resolution).toMatchObject({
          model: 'opus-5',
          effort: 'high',
          source: 'workspace',
        });
      });

      it('session over workspace', () => {
        const resolution = resolveSlot({
          slot,
          layers: {
            workspace: layerWith({ slot, pin: OPUS }),
            project: layerWith({ slot, pin: SONNET }),
            session: layerWith({ slot, pin: SOL }),
          },
          context: { policy: ON },
        });

        expect(resolution).toMatchObject({
          provider: 'codex',
          model: 'gpt-6.1-sol',
          source: 'session',
        });
      });

      it('an explicit turn or agent pick runs on a provider that is Off', () => {
        const policy: ProviderPolicy = [
          { id: 'codex', state: 'on' },
          { id: 'anthropic', state: 'off' },
        ];

        for (const source of ['turn', 'agent'] as const) {
          const resolution = resolveSlot({
            slot,
            layers: { workspace: layerWith({ slot, pin: SOL }) },
            pins: { [source]: OPUS },
            context: { policy },
          });

          expect(resolution).toMatchObject({
            provider: 'anthropic',
            model: 'opus-5',
            source,
            via: 'pin',
            skipped: [],
          });
        }
      });

      it('an explicit pick still needs a connected provider', () => {
        const resolution = resolveSlot({
          slot,
          pins: { turn: OPUS },
          context: { policy: ON, connected: ['codex'] },
        });

        expect(resolution).toMatchObject({ provider: 'codex', source: 'auto' });
        expect(resolution.skipped).toContainEqual({
          source: 'turn',
          provider: 'anthropic',
          model: 'opus-5',
          reason: 'not-connected',
        });
      });

      it('a step or run pin on a provider that is Off is skipped like a saved pin', () => {
        const policy: ProviderPolicy = [
          { id: 'codex', state: 'on' },
          { id: 'anthropic', state: 'off' },
        ];

        for (const source of ['step', 'run'] as const) {
          const resolution = resolveSlot({
            slot,
            pins: { [source]: OPUS },
            context: { policy },
          });

          expect(resolution).toMatchObject({ provider: 'codex', source: 'auto' });
          expect(resolution.skipped).toContainEqual({
            source,
            provider: 'anthropic',
            model: 'opus-5',
            reason: 'off',
          });
        }
      });

      it('run pin over every layer; a skipped turn pin is listed first', () => {
        const resolution = resolveSlot({
          slot,
          layers: { session: layerWith({ slot, pin: SOL }) },
          pins: {
            turn: { providerId: 'anthropic', model: 'claude-opus-99' },
            run: SONNET,
          },
          context: { policy: ON },
        });

        expect(resolution).toMatchObject({
          provider: 'anthropic',
          model: 'sonnet-5',
          source: 'run',
          via: 'pin',
        });
        expect(resolution.skipped).toEqual([
          {
            source: 'turn',
            provider: 'anthropic',
            model: 'claude-opus-99',
            reason: 'unknown-model',
          },
        ]);
      });

      it('pins rank turn, agent, step, run', () => {
        const resolution = resolveSlot({
          slot,
          pins: { run: SONNET, step: OPUS, agent: SOL },
          context: { policy: ON },
        });

        expect(resolution).toMatchObject({ source: 'agent', provider: 'codex' });
      });

      it('policy null: nothing is filtered', () => {
        const resolution = resolveSlot({
          slot,
          layers: { workspace: layerWith({ slot, pin: OPUS }) },
          context: { policy: null },
        });

        expect(resolution).toMatchObject({
          provider: 'anthropic',
          source: 'workspace',
          skipped: [],
        });
      });

      it('Codex only: Auto runs the Codex column', () => {
        const context: ResolveContext = {
          connected: ['codex'],
          policy: [{ id: 'codex', state: 'on' }],
        };
        const resolution = resolveSlot({ slot, context });

        expect(resolution).toMatchObject({
          provider: 'codex',
          source: 'auto',
          via: 'curated',
          defaultProvider: 'codex',
          ...curated({ slot, provider: 'codex' }),
        });
      });
    },
  );
});

describe('resolveSlot auto passes over what cannot run', () => {
  it('an installed CLI too old for the first pick moves down the column and says which', () => {
    const resolution = resolveSlot({
      slot: { kind: 'role', id: 'planner' },
      context: { cliVersions: { anthropic: '2.1.200' } },
    });

    expect(resolution).toMatchObject({ model: 'opus-5', via: 'next-in-column', source: 'auto' });
    expect(resolution.skipped).toEqual([
      { source: 'auto', provider: 'anthropic', model: 'opus-5.5', reason: 'cli-too-old' },
    ]);
  });

  it('a hidden first pick moves down the column and says which', () => {
    const resolution = resolveSlot({
      slot: { kind: 'role', id: 'implementer' },
      context: { hidden: { anthropic: ['sonnet-5.5'] } },
    });

    expect(resolution).toMatchObject({ model: 'sonnet-5', via: 'next-in-column' });
    expect(resolution.skipped).toEqual([
      { source: 'auto', provider: 'anthropic', model: 'sonnet-5.5', reason: 'hidden' },
    ]);
  });

  it('a pin on a hidden model still runs', () => {
    const resolution = resolveSlot({
      slot: { kind: 'role', id: 'implementer' },
      layers: { workspace: layerWith({ slot: { kind: 'role', id: 'implementer' }, pin: OPUS }) },
      context: { hidden: { anthropic: ['opus-5'] } },
    });

    expect(resolution).toMatchObject({ model: 'opus-5', source: 'workspace', skipped: [] });
  });

  it('a role with a model set tries the next model when the first provider is Off', () => {
    const resolution = resolveSlot({
      slot: { kind: 'role', id: 'implementer' },
      layers: {
        workspace: {
          roleModels: {
            implementer: { ...OPUS, models: [OPUS, SOL] },
          },
        },
      },
      context: {
        policy: [
          { id: 'anthropic', state: 'off' },
          { id: 'codex', state: 'on' },
        ],
      },
    });

    expect(resolution).toMatchObject({
      provider: 'codex',
      source: 'workspace',
      via: 'backup',
    });
    expect(resolution.skipped).toEqual([
      { source: 'workspace', provider: 'anthropic', model: 'opus-5', reason: 'off' },
    ]);
  });
});
