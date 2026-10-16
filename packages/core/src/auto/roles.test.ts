import { describe, expect, it, vi } from 'vitest';
import { ROLE_REGISTRY, normalizeAgentRole } from '../roles';
import {
  AUTO_DELEGATION_ROLES,
  AUTO_ROLE_WHEN,
  AUTO_WRITER_ROLES,
  isAutoWriterRole,
  parseAutoDelegationRole,
} from './roles';

describe('AUTO_DELEGATION_ROLES', () => {
  it('is the closed list of ten roles, in one order', () => {
    expect([...AUTO_DELEGATION_ROLES]).toEqual([
      'scout',
      'planner',
      'investigator',
      'reviewer',
      'implementer',
      'tester',
      'docs',
      'scribe',
      'ci-fixer',
      'rewriter',
    ]);
  });

  it('holds only canonical registry ids, each with a when line for the routing table', () => {
    for (const role of AUTO_DELEGATION_ROLES) {
      expect(ROLE_REGISTRY[role].id).toBe(role);
      expect(AUTO_ROLE_WHEN[role].length).toBeGreaterThan(0);
    }
  });

  it('leaves out the roles with their own flows, the Generalist and Auto itself', () => {
    for (const role of ['custom', 'report', 'wireframe', 'resolver', 'ci-debugger', 'auto']) {
      expect(AUTO_DELEGATION_ROLES.some((candidate) => candidate === role)).toBe(false);
    }
  });

  it('has six writers and no reader among them', () => {
    expect([...AUTO_WRITER_ROLES]).toEqual([
      'implementer',
      'tester',
      'docs',
      'scribe',
      'ci-fixer',
      'rewriter',
    ]);
    for (const role of AUTO_DELEGATION_ROLES) {
      expect(isAutoWriterRole({ role })).toBe(AUTO_WRITER_ROLES.some((writer) => writer === role));
    }
    expect(isAutoWriterRole({ role: 'investigator' })).toBe(false);
  });
});

describe('parseAutoDelegationRole', () => {
  it('accepts every listed id', () => {
    for (const role of AUTO_DELEGATION_ROLES) {
      expect(parseAutoDelegationRole({ role })).toBe(role);
    }
  });

  it.each([
    'debugger',
    'writer',
    'generic',
    'custom',
    'report',
    'wireframe',
    'resolver',
    'ci-debugger',
    'ci_fixer',
    'auto',
    'emperor',
    '',
    ' scout',
    'Scout',
  ])('rejects %j without rewriting it to another role', (role) => {
    expect(parseAutoDelegationRole({ role })).toBeNull();
  });

  it.each([undefined, null, 3, {}, ['scout']])(
    'rejects a value that is not a string: %j',
    (role) => {
      expect(parseAutoDelegationRole({ role })).toBeNull();
    },
  );

  it('never falls back to the workflow-eligible Generalist the normalizer picks', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(normalizeAgentRole({ role: 'emperor' })).toBe('custom');
    expect(parseAutoDelegationRole({ role: 'emperor' })).toBeNull();

    warn.mockRestore();
  });
});
