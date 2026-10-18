// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PROVIDER_GATE_HINT, wizardActions } from './wizardCta';
import { WIZARD_STEPS } from './wizardSteps';

const BASE = {
  providersConnected: 1,
  hasWorkspace: true,
  workspaceName: 'Northwind',
  projectCount: 1,
  codeHostConnected: false,
  taskSourceConnected: false,
  isLastStep: false,
  busy: false,
} as const;

describe('wizardActions', () => {
  it('maps every step to its primary action', () => {
    expect(WIZARD_STEPS.map((step) => wizardActions({ ...BASE, step }).primary?.action)).toEqual([
      'next',
      'next',
      'commit-project',
      'next',
      undefined,
    ]);
    expect(wizardActions({ ...BASE, step: 'welcome' }).primary?.label).toBe('Get started');
  });

  it('gates the providers step with a hint while nothing is connected', () => {
    const gated = wizardActions({ ...BASE, step: 'agents', providersConnected: 0 });
    expect(gated.primary?.disabled).toBe(true);
    expect(gated.hint).toBe(PROVIDER_GATE_HINT);
    expect(wizardActions({ ...BASE, step: 'agents' }).hint).toBeNull();
  });

  it('keeps the project step closed until a project and a workspace name exist', () => {
    expect(wizardActions({ ...BASE, step: 'workspace', projectCount: 0 }).primary?.disabled).toBe(
      true,
    );
    expect(
      wizardActions({ ...BASE, step: 'workspace', workspaceName: ' ' }).primary?.disabled,
    ).toBe(true);
    expect(wizardActions({ ...BASE, step: 'workspace' }).primary?.disabled).toBe(false);
  });

  it('offers Skip for now on tools until a code host or a task source is connected', () => {
    const tools = wizardActions({ ...BASE, step: 'tools' });
    expect(tools.skip?.label).toBe('Skip for now');
    expect(tools.primary?.disabled).toBe(true);
    const host = wizardActions({ ...BASE, step: 'tools', codeHostConnected: true });
    expect(host.skip).toBeNull();
    expect(host.primary?.disabled).toBe(false);
    const tasks = wizardActions({ ...BASE, step: 'tools', taskSourceConnected: true });
    expect(tasks.skip).toBeNull();
  });

  it('closes with Done when a reopened step is the last one', () => {
    const single = wizardActions({ ...BASE, step: 'tools', isLastStep: true });
    expect(single.primary?.label).toBe('Done');
    expect(single.primary?.action).toBe('finish');
    expect(single.skip?.action).toBe('finish');
  });

  it('leaves the first session primary to the step, with Skip, open the board in the action row', () => {
    const first = wizardActions({ ...BASE, step: 'first-session' });
    expect(first.primary).toBeNull();
    expect(first.skip?.label).toBe('Skip, open the board');
  });
});
