import { describe, expect, it, vi } from 'vitest';
import {
  ROLE_REGISTRY,
  SELECTABLE_AGENT_ROLES,
  defaultsForRole,
  fanOutCapabilityForRole,
  isAgentRole,
  normalizeAgentRole,
  normalizeSelectableAgentRole,
  presentationKeyForRole,
} from './roles';

describe('ROLE_REGISTRY', () => {
  it('covers every defined AgentRole', () => {
    const expected = [
      'scout',
      'planner',
      'implementer',
      'reviewer',
      'investigator',
      'tester',
      'resolver',
      'docs',
      'report',
      'wireframe',
      'custom',
    ];
    for (const role of expected) {
      expect(ROLE_REGISTRY[role as keyof typeof ROLE_REGISTRY]).toBeDefined();
    }
    expect(Object.keys(ROLE_REGISTRY).sort()).toEqual([...expected].sort());
  });

  it('declares fan-out capability per role', () => {
    expect(ROLE_REGISTRY.scout.fanOut.mode).toBe('natural');
    expect(ROLE_REGISTRY.reviewer.fanOut.mode).toBe('conditional');
    expect(ROLE_REGISTRY.tester.fanOut.mode).toBe('conditional');
    expect(ROLE_REGISTRY.investigator.fanOut.mode).toBe('conditional');
    expect(ROLE_REGISTRY.planner.fanOut.mode).toBe('never');
    expect(ROLE_REGISTRY.implementer.fanOut.mode).toBe('never');
    expect(ROLE_REGISTRY.resolver.fanOut.mode).toBe('never');
    expect(ROLE_REGISTRY.custom.fanOut.mode).toBe('never');
    expect(ROLE_REGISTRY.docs.fanOut.mode).toBe('never');
    expect(ROLE_REGISTRY.report.fanOut.mode).toBe('never');
    expect(ROLE_REGISTRY.wireframe.fanOut.mode).toBe('never');
  });

  it('keeps docs scoped to repository documentation rather than reports', () => {
    expect(ROLE_REGISTRY.docs.prompt).toContain('repository documentation agent');
    expect(ROLE_REGISTRY.docs.prompt).toContain('never produce session reports');
  });
});

describe('ROLE_REGISTRY contract', () => {
  it('has one entry and one canonical id for every AgentRole', () => {
    const ids = Object.values(ROLE_REGISTRY).map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(Object.keys(ROLE_REGISTRY).sort());
  });

  it('resolves every legacy alias to its canonical role and presentation', () => {
    for (const entry of Object.values(ROLE_REGISTRY)) {
      for (const alias of entry.aliases) {
        expect(normalizeAgentRole({ role: alias })).toBe(entry.id);
      }
    }
    expect(normalizeAgentRole({ role: 'writer' })).toBe('docs');
    expect(normalizeAgentRole({ role: 'debugger' })).toBe('investigator');
    expect(normalizeAgentRole({ role: 'generic' })).toBe('custom');
    expect(presentationKeyForRole({ role: 'investigator' })).toBe('debugger');
    expect(presentationKeyForRole({ role: 'custom' })).toBe('generic');
  });

  it('ships report and wireframe as selectable artifact roles the classifier never picks', () => {
    expect(ROLE_REGISTRY.report).toMatchObject({
      outputKind: 'report',
      workflowEligible: true,
      classifierEligible: false,
      selectionEligible: true,
      pickerEligible: false,
    });
    expect(ROLE_REGISTRY.wireframe).toMatchObject({
      outputKind: 'wireframe',
      workflowEligible: true,
      classifierEligible: false,
      selectionEligible: true,
      pickerEligible: false,
    });
  });

  it('preserves the roles available for defaults and workflow selection', () => {
    expect(SELECTABLE_AGENT_ROLES).toEqual([
      'scout',
      'investigator',
      'planner',
      'implementer',
      'reviewer',
      'tester',
      'resolver',
      'docs',
      'report',
      'wireframe',
      'custom',
    ]);
  });

  it('offers every selectable non-artifact role in the manual picker', () => {
    expect(
      Object.values(ROLE_REGISTRY)
        .filter((entry) => entry.pickerEligible)
        .map((entry) => entry.id),
    ).toEqual([
      'scout',
      'investigator',
      'planner',
      'implementer',
      'reviewer',
      'tester',
      'resolver',
      'docs',
      'custom',
    ]);
  });

  it('normalizes every selectable role to itself and the rest to custom', () => {
    expect(normalizeSelectableAgentRole({ role: 'report' })).toBe('report');
    expect(normalizeSelectableAgentRole({ role: 'wireframe' })).toBe('wireframe');
    expect(normalizeSelectableAgentRole({ role: 'emperor' })).toBe('custom');
  });
});

describe('isAgentRole', () => {
  it('returns true for known roles', () => {
    expect(isAgentRole('scout')).toBe(true);
    expect(isAgentRole('planner')).toBe(true);
    expect(isAgentRole('custom')).toBe(true);
  });

  it('returns false for unknown roles', () => {
    expect(isAgentRole('emperor')).toBe(false);
    expect(isAgentRole('')).toBe(false);
  });
});

describe('defaultsForRole', () => {
  it('returns the registered defaults for a known role', () => {
    expect(defaultsForRole('scout')).toBe(ROLE_REGISTRY.scout);
    expect(defaultsForRole('reviewer')).toBe(ROLE_REGISTRY.reviewer);
  });

  it('normalizes aliases before resolving defaults', () => {
    expect(defaultsForRole('writer')).toBe(ROLE_REGISTRY.docs);
    expect(defaultsForRole('debugger')).toBe(ROLE_REGISTRY.investigator);
    expect(defaultsForRole('generic')).toBe(ROLE_REGISTRY.custom);
  });

  it('falls back to custom for an unknown role (no throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(defaultsForRole('emperor')).toBe(ROLE_REGISTRY.custom);
    expect(warn).toHaveBeenCalledWith('[roles] unknown role "emperor"; using custom');
    warn.mockRestore();
  });
});

describe('normalizeAgentRole', () => {
  it('falls back to custom for a missing role instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(normalizeAgentRole({ role: undefined })).toBe('custom');
    expect(warn).toHaveBeenCalledWith('[roles] missing role; using custom');
    warn.mockRestore();
  });
});

describe('fanOutCapabilityForRole', () => {
  it('returns the role fan-out capability for known roles', () => {
    expect(fanOutCapabilityForRole('reviewer')).toEqual(ROLE_REGISTRY.reviewer.fanOut);
  });

  it('falls back to custom for unknown roles', () => {
    expect(fanOutCapabilityForRole('unknown')).toEqual(ROLE_REGISTRY.custom.fanOut);
  });
});
