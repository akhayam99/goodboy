// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_GROUPS, ROLE_REGISTRY, resolveRoleRouting, resolveSlot } from '@goodboy/core';
import type { AgentRole } from '@goodboy/types';
import type { ProviderId } from '@goodboy/types';
import { roleRunFacts } from './roleRunFacts';

const SHOWN_ROLES = DEFAULT_GROUPS.agents.flatMap((group) => group.members);
const PROVIDERS: ReadonlyArray<ProviderId> = ['anthropic', 'codex', 'gemini', 'cursor'];

type AutoParams = {
  readonly role: AgentRole;
  readonly defaultProvider: ProviderId;
};

const autoOf = ({ role, defaultProvider }: AutoParams) =>
  resolveSlot({ slot: { kind: 'role', id: role }, context: { defaultProvider } });

describe('roleRunFacts', () => {
  it('shows the same pick as resolveRoleRouting for every role and default provider', () => {
    for (const defaultProvider of PROVIDERS) {
      for (const role of SHOWN_ROLES) {
        const facts = roleRunFacts({
          role,
          auto: autoOf({ role, defaultProvider }),
          isParallelOn: true,
        });
        const engine = resolveRoleRouting({ role, prefs: null, auto: { defaultProvider } });

        expect({
          provider: facts.auto.provider,
          model: facts.auto.model,
          effort: facts.auto.effort,
        }).toEqual({ provider: engine.provider, model: engine.model, effort: engine.effort });
      }
    }
  });

  it('reads splits from the engine limits, never from copy', () => {
    const scout = roleRunFacts({
      role: 'scout',
      auto: autoOf({ role: 'scout', defaultProvider: 'anthropic' }),
      isParallelOn: true,
    });
    const reviewer = roleRunFacts({
      role: 'reviewer',
      auto: autoOf({ role: 'reviewer', defaultProvider: 'anthropic' }),
      isParallelOn: true,
    });

    expect(scout.split.headline).toBe('Up to 4 scouts, 2 levels');
    expect(reviewer.split.headline).toBe('Up to 4 reviewers, 1 level');
    expect(reviewer.split.note).toBe(ROLE_REGISTRY.reviewer.explain.splitNote);
  });

  it('says a generalist never splits and that a role is picked instead', () => {
    const custom = roleRunFacts({
      role: 'custom',
      auto: autoOf({ role: 'custom', defaultProvider: 'anthropic' }),
      isParallelOn: false,
    });

    expect(custom.split.headline).toBe('Never splits');
    expect(custom.split.note).toBe(ROLE_REGISTRY.custom.explain.splitNote);
    expect(custom.launch).toBe('Nothing.');
  });
});
