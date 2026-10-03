import { describe, expect, it } from 'vitest';
import type { RoleModelPreferences, WorkflowTaskProfile } from '@goodboy/types';
import { keepProposalInRoleSet } from './keepProposalInRoleSet';
import { roleModelSetMenu } from './roleModelSetMenu';
import { stepSizeForDifficulty } from './stepSizeForDifficulty';
import type { OrchestratorModelOption } from './types';

const option = (provider: 'anthropic' | 'codex', model: string): OrchestratorModelOption => ({
  provider,
  model,
  label: model,
  efforts: ['low', 'medium', 'high'],
  taskTypes: [],
  preferredDifficulty: [],
  contextWindow: 200000,
  price: null,
});

const MENU: ReadonlyArray<OrchestratorModelOption> = [
  option('anthropic', 'opus-5.5'),
  option('anthropic', 'sonnet-5.5'),
  option('anthropic', 'haiku-4.5'),
  option('codex', 'gpt-6.1-sol'),
];

const PLANNER_SET: RoleModelPreferences = {
  planner: {
    providerId: 'codex',
    model: 'gpt-6.1-sol',
    effort: 'high',
    models: [
      { providerId: 'codex', model: 'gpt-6.1-sol' },
      { providerId: 'anthropic', model: 'claude-opus-5-5' },
    ],
  },
};

const PROFILE: WorkflowTaskProfile = { taskType: 'planning', difficulty: 'heavy', basis: 'agent' };

describe('roleModelSetMenu', () => {
  it('keeps the whole menu for a role without a set', () => {
    expect(roleModelSetMenu({ menu: MENU, role: 'planner', prefs: null })).toBeNull();
    expect(roleModelSetMenu({ menu: MENU, role: 'tester', prefs: PLANNER_SET })).toBeNull();
  });

  it('narrows the menu to the set, in the order the set gives', () => {
    const narrowed = roleModelSetMenu({ menu: MENU, role: 'planner', prefs: PLANNER_SET });

    expect(narrowed?.map((entry) => `${entry.provider}/${entry.model}`)).toEqual([
      'codex/gpt-6.1-sol',
      'anthropic/opus-5.5',
    ]);
  });

  it('keeps the whole menu when no set model is on it', () => {
    const menu = MENU.filter((entry) => entry.model === 'haiku-4.5');

    expect(roleModelSetMenu({ menu, role: 'planner', prefs: PLANNER_SET })).toBeNull();
  });
});

describe('keepProposalInRoleSet', () => {
  const setMenu = roleModelSetMenu({ menu: MENU, role: 'planner', prefs: PLANNER_SET });

  it('keeps a pick that is in the set', () => {
    const outcome = {
      kind: 'valid',
      proposal: {
        pick: { provider: 'anthropic', model: 'opus-5.5', effort: 'high' },
        source: 'agent',
        reason: 'plan',
        profile: PROFILE,
      },
    } as const;

    expect(keepProposalInRoleSet({ outcome, setMenu })).toBe(outcome);
  });

  it('drops a pick outside the set so the role set decides', () => {
    const outcome = {
      kind: 'valid',
      proposal: {
        pick: { provider: 'anthropic', model: 'haiku-4.5', effort: 'low' },
        source: 'agent',
        reason: 'plan',
        profile: PROFILE,
      },
    } as const;

    expect(keepProposalInRoleSet({ outcome, setMenu })).toEqual({
      kind: 'missing',
      profile: PROFILE,
    });
    expect(keepProposalInRoleSet({ outcome, setMenu: null })).toBe(outcome);
  });
});

describe('stepSizeForDifficulty', () => {
  it('reads the difficulty the orchestrator named as a step size', () => {
    expect(stepSizeForDifficulty('light')).toBe('small');
    expect(stepSizeForDifficulty('standard')).toBe('medium');
    expect(stepSizeForDifficulty('heavy')).toBe('large');
    expect(stepSizeForDifficulty('unknown')).toBeNull();
  });
});
