import { describe, expect, it } from 'vitest';
import { ROLE_REGISTRY } from '../roles';
import { AUTO_BATCH_MAX_CHILDREN } from './limits';
import { AUTO_SYSTEM_PROMPT, autoRoleCatalog, buildAutoSystemPrompt } from './prompt';
import { AUTO_DELEGATION_ROLES, isAutoWriterRole } from './roles';

describe('autoRoleCatalog', () => {
  it('lists every delegable role once, in order, from the registry text', () => {
    const lines = autoRoleCatalog().split('\n').slice(1);

    expect(lines).toHaveLength(AUTO_DELEGATION_ROLES.length);
    AUTO_DELEGATION_ROLES.forEach((role, index) => {
      expect(lines[index]).toContain(`- ${role} (`);
      expect(lines[index]).toContain(ROLE_REGISTRY[role].summary);
      expect(lines[index]).toContain(ROLE_REGISTRY[role].explain.does);
    });
  });

  it('marks the writers and the readers', () => {
    for (const role of AUTO_DELEGATION_ROLES) {
      const line = autoRoleCatalog()
        .split('\n')
        .find((candidate) => candidate.startsWith(`- ${role} (`));
      expect(line).toContain(isAutoWriterRole({ role }) ? '(changes files)' : '(read only)');
    }
  });

  it('names no role outside the closed list', () => {
    for (const role of ['custom', 'report', 'wireframe', 'resolver', 'rewriter', 'scribe']) {
      expect(autoRoleCatalog()).not.toContain(`- ${role} (`);
    }
  });
});

describe('buildAutoSystemPrompt', () => {
  it('says the agent answers or hands work over and never edits', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: false });

    expect(prompt).toContain('You are Auto');
    expect(prompt).toContain('Answer it yourself');
    expect(prompt).toContain('never edit files');
  });

  it('speaks of no command while delegation is off', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: false });

    expect(prompt).not.toContain('goodboy agent');
    expect(prompt).toContain('not available yet');
  });

  it('teaches the delegation commands once it is on', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true });

    expect(prompt).toContain('goodboy agent delegate --request-id');
    expect(prompt).toContain('goodboy agent request-status');
    expect(prompt).toContain(`one to ${AUTO_BATCH_MAX_CHILDREN} children`);
    expect(prompt).not.toContain('not available yet');
  });

  it('carries the role list and the language rule in both modes', () => {
    for (const isDelegationEnabled of [false, true]) {
      const prompt = buildAutoSystemPrompt({ isDelegationEnabled });

      expect(prompt).toContain(autoRoleCatalog());
      expect(prompt).toContain('Answer in the language that message is written in');
    }
  });

  it('has no em dash and no en dash', () => {
    for (const isDelegationEnabled of [false, true]) {
      const prompt = buildAutoSystemPrompt({ isDelegationEnabled });

      expect(prompt).not.toContain(String.fromCharCode(0x2013));
      expect(prompt).not.toContain(String.fromCharCode(0x2014));
    }
  });

  it('ships the answer-only prompt while delegation is off', () => {
    expect(AUTO_SYSTEM_PROMPT).toBe(buildAutoSystemPrompt({ isDelegationEnabled: false }));
  });
});
