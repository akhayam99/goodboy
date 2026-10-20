import { describe, expect, it } from 'vitest';
import { AUTO_DELEGATION_ROLES } from './auto/roles';
import { buildAutoSystemPrompt } from './auto/prompt';
import {
  ORCHESTRATOR_MODEL_PICK_SYSTEM_PROMPT,
  ORCHESTRATOR_SYSTEM_PROMPT,
} from './orchestrator/prompt';
import { ROLE_REGISTRY, SELECTABLE_AGENT_ROLES } from './roles';
import { ROLE_NEEDS, roleNeedRows, roleNeedsSection } from './roleNeeds';

const ORCHESTRATOR_ROLES = SELECTABLE_AGENT_ROLES.filter(
  (role) => ROLE_REGISTRY[role].workflowEligible,
);

const AUTO_ONLY_ROLES = ['rewriter', 'scribe', 'ci-fixer'] as const;

describe('roleNeedRows', () => {
  it('keeps every Auto row on a role Auto can delegate to', () => {
    for (const row of roleNeedRows({ driver: 'auto' })) {
      expect(AUTO_DELEGATION_ROLES).toContain(row.role);
    }
  });

  it('keeps every Orchestrator row on a role its vocabulary holds', () => {
    for (const row of roleNeedRows({ driver: 'orchestrator' })) {
      expect(ORCHESTRATOR_ROLES).toContain(row.role);
    }
  });

  it('gives each role at most one row', () => {
    const roles = ROLE_NEEDS.map((row) => row.role);

    expect(new Set(roles).size).toBe(roles.length);
  });

  it('offers the rewriter, scribe and CI fixer to Auto only', () => {
    const auto = roleNeedRows({ driver: 'auto' }).map((row) => row.role);
    const orchestrator = roleNeedRows({ driver: 'orchestrator' }).map((row) => row.role);

    for (const role of AUTO_ONLY_ROLES) {
      expect(auto).toContain(role);
      expect(orchestrator).not.toContain(role);
    }
  });

  it('covers every Auto role that is not the implementer', () => {
    const rows = roleNeedRows({ driver: 'auto' }).map((row) => row.role);

    for (const role of AUTO_DELEGATION_ROLES.filter((candidate) => candidate !== 'implementer')) {
      expect(rows).toContain(role);
    }
  });
});

describe('roleNeedsSection', () => {
  it('names the default and the precedence per driver', () => {
    const auto = roleNeedsSection({ driver: 'auto' });
    const orchestrator = roleNeedsSection({ driver: 'orchestrator' });

    expect(auto).toContain('one implementer with nothing added');
    expect(auto).toContain('a reviewer always joins');
    expect(orchestrator).toContain('the fewest steps');
    expect(orchestrator).not.toContain('a reviewer always joins');
  });

  it('adds the ticked checks clause for Auto only', () => {
    expect(roleNeedsSection({ driver: 'auto' })).toContain('No Auto checks are ticked');
    expect(roleNeedsSection({ driver: 'orchestrator' })).not.toContain('Auto checks');
  });

  it('has no em dash and no en dash', () => {
    for (const driver of ['auto', 'orchestrator'] as const) {
      const text = roleNeedsSection({ driver });

      expect(text).not.toContain(String.fromCharCode(0x2013));
      expect(text).not.toContain(String.fromCharCode(0x2014));
    }
  });
});

describe('the prompts that render the table', () => {
  it('puts every Auto row and the decide-once rule in the Auto prompt', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true });

    expect(prompt).toContain(roleNeedsSection({ driver: 'auto' }));
    expect(prompt).toContain('Decide once before you fan out');
    for (const row of roleNeedRows({ driver: 'auto' })) {
      expect(prompt).toContain(`- ${row.role}. Add it when:`);
    }
  });

  it('puts every Orchestrator row in both Orchestrator prompts and no Auto only role', () => {
    const roles = roleNeedRows({ driver: 'orchestrator' }).map((row) => row.role);

    for (const prompt of [ORCHESTRATOR_SYSTEM_PROMPT, ORCHESTRATOR_MODEL_PICK_SYSTEM_PROMPT]) {
      expect(prompt).toContain(roleNeedsSection({ driver: 'orchestrator' }));
      for (const role of AUTO_ONLY_ROLES) {
        expect(prompt).not.toContain(`- ${role}. Add it when:`);
      }
      for (const role of roles) {
        expect(prompt).toContain(`- ${role}. Add it when:`);
      }
    }
  });

  it('lets the Orchestrator skip discovery when the goal names the files', () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('the goal already names the files to change');
  });
});
