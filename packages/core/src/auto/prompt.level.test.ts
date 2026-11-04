import { describe, expect, it } from 'vitest';
import { WORKFLOW_AUTONOMY_VALUES } from '@goodboy/types';
import { buildAutoSystemPrompt } from './prompt';

describe('Auto prompt levels', () => {
  it('requires confirmation for every child at Every step', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true, level: 'step' });

    expect(prompt).toContain('Asks you: Every step');
    expect(prompt).toContain("Every child needs the user's Confirm before it starts");
    expect(prompt).toContain('including scouts, planners, investigators, reviewers and writers');
    expect(prompt).toContain('One next step card at a time');
    expect(prompt).not.toContain('Asks you: After the plan');
    expect(prompt).not.toContain('Asks you: Never');
  });

  it('continues after plan approval without asking for each handoff', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true, level: 'plan' });

    expect(prompt).toContain('Asks you: After the plan');
    expect(prompt).toContain('Scouts, planners, investigators and reviewers start without asking');
    expect(prompt).toContain(
      'Once the plan is approved, hand work to writers without asking again',
    );
    expect(prompt).toContain('Only propose a next step when you are stuck and need a user choice');
    expect(prompt).not.toContain('Asks you: Every step');
    expect(prompt).not.toContain('Asks you: Never');
  });

  for (const level of ['step', 'plan'] as const) {
    it(`requires a real planner artifact before a change at ${level}`, () => {
      const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true, level });

      expect(prompt).toContain('For a change, delegate to a planner first');
      expect(prompt).toContain('wait for its plan artifact');
      expect(prompt).toContain('never write the plan as chat prose');
      expect(prompt).toContain("wait for the user's approval before handing work to a writer");
      expect(prompt).toContain(
        'These level rules take precedence over WHEN TO ADD A ROLE for planning and confirmation',
      );
    });
  }

  it('lets Never choose and delegate with no required plan or proposal', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true, level: 'run' });

    expect(prompt).toContain('Asks you: Never');
    expect(prompt).toContain('A planner and a plan are optional');
    expect(prompt).toContain('writers can start without an approved plan');
    expect(prompt).toContain('Do not propose a next step or wait for permission');
    expect(prompt).toContain('decide, delegate and say what you chose when you report');
    expect(prompt).not.toContain('For a change, delegate to a planner first');
    expect(prompt).not.toContain('Asks you: After the plan');
    expect(prompt).not.toContain('Asks you: Every step');
  });

  it('defaults to After the plan independently of the workflow default', () => {
    expect(buildAutoSystemPrompt({ isDelegationEnabled: true })).toBe(
      buildAutoSystemPrompt({ isDelegationEnabled: true, level: 'plan' }),
    );
    expect(buildAutoSystemPrompt({ isDelegationEnabled: true })).toContain(
      'Asks you: After the plan',
    );
  });

  for (const level of WORKFLOW_AUTONOMY_VALUES) {
    it(`forbids prose yes or no questions and keeps the force push floor at ${level}`, () => {
      const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true, level });

      expect(prompt).toContain('Never end a turn with a yes or no question in prose');
      expect(prompt).toContain('a proposal the app renders as a card');
      expect(prompt).toContain('When the level allows the next step, take it');
      expect(prompt).toContain('A force push waits for the user to confirm and keeps a backup');
    });

    it(`keeps delegation unavailable and forbids prose permission questions at ${level}`, () => {
      const prompt = buildAutoSystemPrompt({ isDelegationEnabled: false, level });

      expect(prompt).toContain('Never end a turn with a yes or no question in prose');
      expect(prompt).toContain('not available yet');
      expect(prompt).not.toContain('Asks you:');
      expect(prompt).not.toContain('<<auto>>');
    });
  }

  const NEVER_STOP = 'Never end a turn saying you cannot because of mounts, tools or permissions';

  it('delegates by the Never temperature instead of saying it cannot', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true, level: 'run' });

    expect(prompt).toContain(NEVER_STOP);
    expect(prompt).toContain('At Never, delegate at once, with no proposal and no question');
  });

  it('follows the plan gate as a step forward at After the plan', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true, level: 'plan' });

    expect(prompt).toContain(NEVER_STOP);
    expect(prompt).toContain('A refusal or a plan gate is a step forward, never a dead end');
    expect(prompt).toContain('At After the plan, follow the plan gate above');
  });

  it('proposes the missing role as a card at Every step', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true, level: 'step' });

    expect(prompt).toContain(NEVER_STOP);
    expect(prompt).toContain('At Every step, hand that work over as a propose block');
  });

  it('teaches the mount block and the named branch at every level', () => {
    for (const level of WORKFLOW_AUTONOMY_VALUES) {
      const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true, level });

      expect(prompt).toContain('"action":"mount"');
      expect(prompt).toContain('Never start an implementer only to run git worktree add');
      expect(prompt).toContain('Never invent a branch name when the user gave one');
    }
  });

  it('uses the supplied level again on each call', () => {
    for (const level of ['step', 'run', 'plan', 'step'] as const) {
      const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true, level });
      const label = { step: 'Every step', plan: 'After the plan', run: 'Never' }[level];

      expect(prompt).toContain(`Asks you: ${label}`);
    }
  });
});
