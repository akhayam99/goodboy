import { describe, expect, it } from 'vitest';
import { ROLE_REGISTRY } from '../roles';
import { AUTO_BATCH_MAX_CHILDREN } from './limits';
import { parseDelegateSpec } from './delegateSpec';
import {
  AUTO_SPEC_EXAMPLE,
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

const BRIDGE_COMMAND =
  '"/Users/ana/Library/Application Support/Goodboy/Goodboy.app/Contents/MacOS/goodboy" query agent';

describe('the inline delegate spec', () => {
  it('is the documented example and parses as a real spec with an escaped apostrophe', () => {
    const outcome = parseDelegateSpec({ text: AUTO_SPEC_EXAMPLE });

    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') {
      return;
    }
    expect(outcome.children[0]?.reason).toContain("scout's job");
    expect(AUTO_SPEC_EXAMPLE).not.toContain("'");
    expect(AUTO_SPEC_EXAMPLE).not.toContain('\n');
  });

  it('is shown inside single quotes after --spec, on one line, with the escape rule', () => {
    const prompt = buildAutoSystemPrompt({
      isDelegationEnabled: true,
      bridgeCommand: BRIDGE_COMMAND,
    });

    expect(prompt).toContain(
      `${BRIDGE_COMMAND} delegate --request-id <id> --spec '${AUTO_SPEC_EXAMPLE}'`,
    );
    expect(prompt).toContain('\\u0027');
    expect(prompt).toContain('Never use a file, a pipe, a heredoc or standard input');
    expect(prompt).not.toContain('--spec <file>');
  });
});

describe('buildAutoSystemPrompt', () => {
  it('says the agent answers or hands work over and never edits', () => {
    const prompt = buildAutoSystemPrompt({
      isDelegationEnabled: false,
      bridgeCommand: BRIDGE_COMMAND,
    });

    expect(prompt).toContain('You are Auto');
    expect(prompt).toContain('Answer it yourself');
    expect(prompt).toContain('never edit files');
  });

  it('speaks of no command while delegation is off', () => {
    const prompt = buildAutoSystemPrompt({
      isDelegationEnabled: false,
      bridgeCommand: BRIDGE_COMMAND,
    });

    expect(prompt).not.toContain(BRIDGE_COMMAND);
    expect(prompt).not.toContain('goodboy agent');
    expect(prompt).toContain('not available yet');
  });

  it('teaches the delegation commands once it is on', () => {
    const prompt = buildAutoSystemPrompt({
      isDelegationEnabled: true,
      bridgeCommand: BRIDGE_COMMAND,
    });

    expect(prompt).toContain(`${BRIDGE_COMMAND} delegate --request-id`);
    expect(prompt).toContain(`${BRIDGE_COMMAND} request-status`);
    expect(prompt).toContain(`${BRIDGE_COMMAND} status`);
    expect(prompt).toContain(`${BRIDGE_COMMAND} answer`);
    expect(prompt).toContain(`${BRIDGE_COMMAND} finish`);
    expect(prompt).toContain(`one to ${AUTO_BATCH_MAX_CHILDREN} children`);
    expect(prompt).not.toContain('not available yet');
  });

  it('gives the absolute quoted path and no variable in any command', () => {
    const prompt = buildAutoSystemPrompt({
      isDelegationEnabled: true,
      bridgeCommand: BRIDGE_COMMAND,
    });
    const commandLines = prompt.split('\n').filter((line) => line.includes('`'));

    expect(prompt).not.toContain('GOODBOY_BIN');
    expect(prompt).not.toContain('$');
    expect(commandLines.length).toBeGreaterThan(0);
    for (const line of commandLines.filter((candidate) => candidate.includes(' query agent '))) {
      expect(line).toContain(`\`${BRIDGE_COMMAND} `);
    }
  });

  it('answers only while the bridge command is unknown, whatever the gate says', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true, bridgeCommand: null });

    expect(prompt).toContain('not available yet');
    expect(prompt).not.toContain('delegate --request-id');
  });

  it('carries the role list and the language rule in both modes', () => {
    for (const isDelegationEnabled of [false, true]) {
      const prompt = buildAutoSystemPrompt({ isDelegationEnabled, bridgeCommand: BRIDGE_COMMAND });

      expect(prompt).toContain(autoRoleCatalog());
      expect(prompt).toContain('Answer in the language that message is written in');
    }
  });

  it('has no em dash and no en dash', () => {
    for (const isDelegationEnabled of [false, true]) {
      const prompt = buildAutoSystemPrompt({ isDelegationEnabled, bridgeCommand: BRIDGE_COMMAND });

      expect(prompt).not.toContain(String.fromCharCode(0x2013));
      expect(prompt).not.toContain(String.fromCharCode(0x2014));
    }
  });

  it('ships the answer-only prompt while delegation is off', () => {
    expect(AUTO_SYSTEM_PROMPT).toBe(
      buildAutoSystemPrompt({ isDelegationEnabled: false, bridgeCommand: null }),
    );
  });
});
