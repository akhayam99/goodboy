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
  autoRoutingTable,
  buildAutoSystemPrompt,
} from './prompt';
import { AUTO_DELEGATION_ROLES, AUTO_ROLE_WHEN, isAutoWriterRole } from './roles';

describe('the delegate rules and the model', () => {
  it('asks for a difficulty per child and never for a model or an effort', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true });

    expect(prompt).toContain('a difficulty and a done-when line');
    expect(prompt).toContain('light, standard or heavy');
    expect(prompt).toContain('never name a model or an effort');
    expect(prompt).not.toContain('a mount, a model, an effort');
  });
});

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
    for (const role of ['custom', 'report', 'wireframe', 'resolver', 'ci-debugger']) {
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

  it('routes each kind of work to one role, generated from the role list', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true });
    const table = autoRoutingTable();

    expect(prompt).toContain(table);
    for (const role of AUTO_DELEGATION_ROLES) {
      expect(table).toContain(`- To ${AUTO_ROLE_WHEN[role]}: ${role}.`);
    }
    expect(AUTO_ROLE_WHEN.investigator).toContain('diagnose a failure');
    expect(AUTO_ROLE_WHEN.scribe).toContain('pull request');
    expect(AUTO_ROLE_WHEN['ci-fixer']).toContain('failing check');
    expect(AUTO_ROLE_WHEN.rewriter).toContain('commit history');
  });

  it('asks for hand overs that name the role, never for actions of its own', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true });

    expect(prompt).toContain('describe it as a hand over and name the role');
    expect(prompt).toContain(
      'Never say that you will change, fix, run or install something yourself.',
    );
  });

  it('asks Auto to name the agents of its results instead of repeating their reports', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true });

    expect(prompt).toContain('as the card of the agent that made it');
    expect(prompt).toContain('Never repeat or paste what an agent said.');
    expect(prompt).toContain('Name the agent as the results name it, by its title');
    expect(buildAutoSystemPrompt({ isDelegationEnabled: false })).not.toContain(
      'Never repeat or paste what an agent said.',
    );
  });

  it('teaches the MOUNTS line and the mount field, with the field in the example', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true });

    expect(prompt).toContain('The MOUNTS line lists the folders agents can work in');
    expect(prompt).toContain('`mount` field');
    expect(AUTO_DELEGATE_EXAMPLE).toContain('"mount":');
  });

  it('teaches the publish field and says Goodboy pushes, never the agent', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true });

    expect(prompt).toContain('An agent never pushes.');
    expect(prompt).toContain('"publish":"push"');
    expect(prompt).toContain('A force push waits for the user to confirm and keeps a backup.');
    expect(
      parseDelegateSpec({
        text: JSON.stringify([
          { role: 'implementer', task: 'x', reason: 'y', publish: { mode: 'force' } },
        ]),
      }).kind,
    ).toBe('ok');
  });

  it('ships the delegation prompt now the release gate is on', () => {
    expect(AUTO_SYSTEM_PROMPT).toBe(buildAutoSystemPrompt({ isDelegationEnabled: true }));
  });
});

describe('the guidance of one run in the Auto prompt', () => {
  const GUIDANCE = 'Keep every change inside payments-api.';

  it('adds one guidance block that holds the text and names it as the run guidance', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true, guidance: GUIDANCE });

    expect(prompt).toContain(
      `GUIDANCE FOR THIS RUN\nThe user gave this guidance for the whole run. Follow it in every decision. Goodboy also hands it to each agent you start.\n${GUIDANCE}`,
    );
    expect(prompt.split('GUIDANCE FOR THIS RUN')).toHaveLength(2);
  });

  it('puts the guidance after the level rules and before the role catalog', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true, guidance: GUIDANCE });

    expect(prompt.indexOf('Asks you:')).toBeLessThan(prompt.indexOf('GUIDANCE FOR THIS RUN'));
    expect(prompt.indexOf('GUIDANCE FOR THIS RUN')).toBeLessThan(
      prompt.indexOf('ROLES YOU CAN HAND WORK TO'),
    );
  });

  it('leaves the prompt byte for byte the same when the guidance is unset, null or blank', () => {
    const plain = buildAutoSystemPrompt({ isDelegationEnabled: true });

    expect(buildAutoSystemPrompt({ isDelegationEnabled: true, guidance: null })).toBe(plain);
    expect(buildAutoSystemPrompt({ isDelegationEnabled: true, guidance: '  \n ' })).toBe(plain);
    expect(plain).not.toContain('GUIDANCE FOR THIS RUN');
  });

  it('adds the guidance when delegation is off too', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: false, guidance: GUIDANCE });

    expect(prompt).toContain(`\n${GUIDANCE}`);
  });
});
