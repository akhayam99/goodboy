import { describe, expect, it } from 'vitest';
import { ROLE_REGISTRY } from '../roles';
import { parseAutoBlock } from './autoBlock';
import { AUTO_BATCH_MAX_CHILDREN } from './limits';
import { parseDelegateSpec } from './delegateSpec';
import {
  AUTO_ANSWER_EXAMPLE,
  AUTO_DELEGATE_EXAMPLE,
  AUTO_FINISH_EXAMPLE,
  AUTO_SYSTEM_PROMPT,
  autoRoleCatalog,
  buildAutoSystemPrompt,
} from './prompt';
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

describe('the block examples', () => {
  it('parse as real blocks, the delegate one with a spec the admission accepts', () => {
    const delegate = parseAutoBlock({ text: AUTO_DELEGATE_EXAMPLE });

    expect(delegate.kind).toBe('block');
    if (delegate.kind !== 'block' || delegate.block.action !== 'delegate') {
      throw new Error('expected a delegate block');
    }
    expect(parseDelegateSpec({ text: delegate.block.spec }).kind).toBe('ok');
    expect(parseAutoBlock({ text: AUTO_ANSWER_EXAMPLE }).kind).toBe('block');
    expect(parseAutoBlock({ text: AUTO_FINISH_EXAMPLE }).kind).toBe('block');
  });
});

describe('buildAutoSystemPrompt', () => {
  it('says the agent answers or hands work over and never edits', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: false });

    expect(prompt).toContain('You are Auto');
    expect(prompt).toContain('Answer it yourself');
    expect(prompt).toContain('never edit files');
  });

  it('speaks of no block while delegation is off', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: false });

    expect(prompt).not.toContain('<<auto>>');
    expect(prompt).toContain('not available yet');
  });

  it('teaches the three block actions once delegation is on', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true });

    expect(prompt).toContain(AUTO_DELEGATE_EXAMPLE);
    expect(prompt).toContain(AUTO_ANSWER_EXAMPLE);
    expect(prompt).toContain(AUTO_FINISH_EXAMPLE);
    expect(prompt).toContain(`one to ${AUTO_BATCH_MAX_CHILDREN} children`);
    expect(prompt).not.toContain('not available yet');
  });

  it('names no command, no bridge, no shell and no capability', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true });

    expect(prompt).not.toContain('query agent');
    expect(prompt).not.toContain('GOODBOY');
    expect(prompt).not.toContain('request-status');
    expect(prompt).not.toContain('--spec');
    expect(prompt).toContain('You have no shell');
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
