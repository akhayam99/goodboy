// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_GROUPS, ROLE_REGISTRY, resolveRoleRouting } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { roleRunFacts } from './roleRunFacts';

const SHOWN_ROLES = DEFAULT_GROUPS.agents.flatMap((group) => group.members);
const PROVIDERS: ReadonlyArray<ProviderId> = ['anthropic', 'codex', 'gemini', 'cursor'];

describe('roleRunFacts', () => {
  it('shows the same pick as resolveRoleRouting for every role and default provider', () => {
    for (const defaultProvider of PROVIDERS) {
      for (const role of SHOWN_ROLES) {
        const autoContext = { defaultProvider };
        const facts = roleRunFacts({ role, autoContext, isParallelOn: true });
        const engine = resolveRoleRouting({ role, prefs: null, auto: autoContext });

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
      autoContext: { defaultProvider: 'anthropic' },
      isParallelOn: true,
    });
    const reviewer = roleRunFacts({
      role: 'reviewer',
      autoContext: { defaultProvider: 'anthropic' },
      isParallelOn: true,
    });

    expect(scout.split.headline).toBe('Up to 4 scouts, 2 levels');
    expect(reviewer.split.headline).toBe('Up to 4 reviewers, 1 level');
    expect(reviewer.split.note).toBe(ROLE_REGISTRY.reviewer.explain.splitNote);
  });

  it('says a generalist never splits and that a role is picked instead', () => {
    const custom = roleRunFacts({
      role: 'custom',
      autoContext: { defaultProvider: 'anthropic' },
      isParallelOn: false,
    });

    expect(custom.split.headline).toBe('Never splits');
    expect(custom.split.note).toBe(ROLE_REGISTRY.custom.explain.splitNote);
    expect(custom.launch).toBe('Nothing.');
  });
});
