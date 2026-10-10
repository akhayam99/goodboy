import { describe, expect, it } from 'vitest';
import type { RoleModelPreference, TaskModelPreference } from '@goodboy/types';
import { mergeLayers, pinSourceOf } from './layers';

const OPUS: RoleModelPreference = { providerId: 'anthropic', model: 'opus-5', effort: 'high' };

const SONNET: RoleModelPreference = {
  providerId: 'anthropic',
  model: 'sonnet-5',
  effort: 'medium',
};

const SOL: TaskModelPreference = { providerId: 'codex', model: 'gpt-6.1-sol' };

describe('mergeLayers', () => {
  it('returns null for every key when no layer sets anything', () => {
    expect(mergeLayers({})).toEqual({
      roleModels: null,
      taskModels: null,
      providerPool: null,
      defaultProviderId: null,
    });
  });

  it('merges role keys one by one, the narrower layer winning', () => {
    const merged = mergeLayers({
      workspace: { roleModels: { planner: OPUS, reviewer: OPUS } },
      project: { roleModels: { reviewer: SONNET } },
      session: { roleModels: { scout: SONNET } },
    });

    expect(merged.roleModels).toEqual({ planner: OPUS, reviewer: SONNET, scout: SONNET });
  });

  it('merges task keys apart from role keys', () => {
    const merged = mergeLayers({
      workspace: { taskModels: { summarizer: SOL }, roleModels: { planner: OPUS } },
      session: { taskModels: { prose_polish: SOL } },
    });

    expect(merged.taskModels).toEqual({ summarizer: SOL, prose_polish: SOL });
    expect(merged.roleModels).toEqual({ planner: OPUS });
  });

  it('skips a key a narrower layer leaves undefined', () => {
    const merged = mergeLayers({
      workspace: { roleModels: { planner: OPUS } },
      project: { roleModels: { planner: undefined } },
    });

    expect(merged.roleModels).toEqual({ planner: OPUS });
  });

  it('takes the pool and the default provider from the narrowest layer that sets one', () => {
    const merged = mergeLayers({
      workspace: {
        providerPool: [{ id: 'anthropic', state: 'on' }],
        defaultProviderId: 'anthropic',
      },
      project: { defaultProviderId: 'codex' },
    });

    expect(merged.providerPool).toEqual([{ id: 'anthropic', state: 'on' }]);
    expect(merged.defaultProviderId).toBe('codex');
  });

  it('returns the same object for the same layer objects', () => {
    const workspace = { roleModels: { planner: OPUS } };
    const project = { roleModels: { reviewer: SONNET } };

    expect(mergeLayers({ workspace, project }).roleModels).toBe(
      mergeLayers({ workspace, project }).roleModels,
    );
  });
});

describe('pinSourceOf', () => {
  const slot = { kind: 'role', id: 'planner' } as const;

  it('names the narrowest layer that pins the slot', () => {
    expect(
      pinSourceOf({
        slot,
        layers: {
          workspace: { roleModels: { planner: OPUS } },
          project: { roleModels: { planner: SONNET } },
        },
      }),
    ).toBe('project');
  });

  it('is null when no layer pins the slot', () => {
    expect(
      pinSourceOf({ slot, layers: { workspace: { roleModels: { scout: OPUS } } } }),
    ).toBeNull();
  });

  it('tells a role pin from a task pin', () => {
    expect(
      pinSourceOf({
        slot: { kind: 'task', id: 'summarizer' },
        layers: { session: { roleModels: { planner: OPUS } } },
      }),
    ).toBeNull();
  });
});
