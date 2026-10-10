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

  it('merges role keys one by one, the session winning over the workspace', () => {
    const merged = mergeLayers({
      workspace: { roleModels: { planner: OPUS, reviewer: OPUS } },
      session: { roleModels: { reviewer: SONNET, scout: SONNET } },
    });

    expect(merged.roleModels).toEqual({ planner: OPUS, reviewer: SONNET, scout: SONNET });
  });

  it('ignores the role and task models of a project layer', () => {
    const merged = mergeLayers({
      workspace: { roleModels: { planner: OPUS }, taskModels: { summarizer: SOL } },
      project: {
        roleModels: { planner: SONNET, reviewer: SONNET },
        taskModels: { summarizer: { providerId: 'anthropic', model: 'sonnet-5' } },
      },
    });

    expect(merged.roleModels).toEqual({ planner: OPUS });
    expect(merged.taskModels).toEqual({ summarizer: SOL });
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
      session: { roleModels: { planner: undefined } },
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
    const session = { roleModels: { reviewer: SONNET } };

    expect(mergeLayers({ workspace, session }).roleModels).toBe(
      mergeLayers({ workspace, session }).roleModels,
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
          session: { roleModels: { planner: SONNET } },
        },
      }),
    ).toBe('session');
  });

  it('never names the project layer, which no longer pins a model', () => {
    expect(
      pinSourceOf({
        slot,
        layers: {
          workspace: { roleModels: { planner: OPUS } },
          project: { roleModels: { planner: SONNET } },
        },
      }),
    ).toBe('workspace');
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
