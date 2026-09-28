import { describe, expect, it } from 'vitest';
import { PROVIDER_GATE_HINT, wizardActions } from './wizardCta';
import { WIZARD_STEPS, visibleWizardSteps } from './wizardSteps';

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
      'next',
      undefined,
    ]);
    expect(wizardActions({ ...BASE, step: 'welcome' }).primary?.label).toBe('Get started');
  });

  it('gates the providers step with a hint while nothing is connected', () => {
    const gated = wizardActions({ ...BASE, step: 'providers', providersConnected: 0 });
    expect(gated.primary?.disabled).toBe(true);
    expect(gated.hint).toBe(PROVIDER_GATE_HINT);
    expect(wizardActions({ ...BASE, step: 'providers' }).hint).toBeNull();
  });

  it('keeps the project step closed until a project and a workspace name exist', () => {
    expect(wizardActions({ ...BASE, step: 'project', projectCount: 0 }).primary?.disabled).toBe(
      true,
    );
    expect(wizardActions({ ...BASE, step: 'project', workspaceName: ' ' }).primary?.disabled).toBe(
      true,
    );
    expect(wizardActions({ ...BASE, step: 'project' }).primary?.disabled).toBe(false);
  });

  it('offers Skip for now on code host and tasks until something is connected', () => {
    const codeHost = wizardActions({ ...BASE, step: 'code-host' });
    expect(codeHost.skip?.label).toBe('Skip for now');
    expect(codeHost.primary?.disabled).toBe(true);
    const connected = wizardActions({ ...BASE, step: 'code-host', codeHostConnected: true });
    expect(connected.skip).toBeNull();
    expect(connected.primary?.disabled).toBe(false);
    expect(wizardActions({ ...BASE, step: 'tasks' }).skip?.label).toBe('Skip for now');
  });

  it('closes with Done when a reopened step is the last one', () => {
    const single = wizardActions({ ...BASE, step: 'tasks', isLastStep: true });
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

describe('visibleWizardSteps', () => {
  it('runs the five numbered steps after Welcome', () => {
    expect(visibleWizardSteps({ mode: 'full', start: null, skipsCodeHost: false })).toEqual(
      WIZARD_STEPS,
    );
  });

  it('skips Code host when no project is a git folder', () => {
    expect(visibleWizardSteps({ mode: 'full', start: null, skipsCodeHost: true })).not.toContain(
      'code-host',
    );
  });

  it('starts setup mode at Code host and runs to the first session', () => {
    expect(visibleWizardSteps({ mode: 'setup', start: null, skipsCodeHost: false })).toEqual([
      'code-host',
      'tasks',
      'first-session',
    ]);
  });

  it('opens a single step on its own', () => {
    expect(visibleWizardSteps({ mode: 'single', start: 'tasks', skipsCodeHost: false })).toEqual([
      'tasks',
    ]);
  });
});
