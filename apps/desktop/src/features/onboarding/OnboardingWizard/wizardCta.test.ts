import { describe, expect, it } from 'vitest';
import { PROVIDER_GATE_HINT, wizardCta } from './wizardCta';
import { WIZARD_STEPS, visibleWizardSteps } from './wizardSteps';

const BASE = {
  providersConnected: 1,
  shape: 'workspace',
  hasWorkspace: true,
  workspaceName: 'Harborline',
  projectCount: 1,
  busy: false,
} as const;

describe('wizardCta', () => {
  it('maps every step to its call to action', () => {
    expect(WIZARD_STEPS.map((step) => wizardCta({ ...BASE, step })?.action)).toEqual([
      'next',
      'next',
      'commit-name',
      'next',
      'commit-profile',
      'finish',
    ]);
    expect(wizardCta({ ...BASE, step: 'welcome' })?.label).toBe('Get started');
    expect(wizardCta({ ...BASE, step: 'ready' })?.label).toBe('Start building');
  });

  it('gates the providers step with a hint while nothing is connected', () => {
    expect(wizardCta({ ...BASE, step: 'providers', providersConnected: 0 })).toEqual({
      label: 'Continue',
      action: 'next',
      disabled: true,
      hint: PROVIDER_GATE_HINT,
    });
    expect(wizardCta({ ...BASE, step: 'providers' })?.hint).toBeNull();
  });

  it('returns no call to action while a single project is picked without a workspace', () => {
    expect(wizardCta({ ...BASE, step: 'shape', shape: 'single', hasWorkspace: false })).toBeNull();
  });

  it('offers Create workspace until a workspace exists and needs a shape and a name', () => {
    const create = wizardCta({ ...BASE, step: 'shape', hasWorkspace: false, workspaceName: ' ' });
    expect(create?.label).toBe('Create workspace');
    expect(create?.disabled).toBe(true);
    expect(wizardCta({ ...BASE, step: 'shape', shape: null })?.disabled).toBe(true);
  });

  it('keeps the projects step closed until one project is linked', () => {
    expect(wizardCta({ ...BASE, step: 'projects', projectCount: 0 })?.disabled).toBe(true);
  });
});

describe('visibleWizardSteps', () => {
  it('drops the projects step for a single project', () => {
    expect(visibleWizardSteps({ mode: 'full', shape: 'single' })).not.toContain('projects');
    expect(visibleWizardSteps({ mode: 'full', shape: 'workspace' })).toEqual(WIZARD_STEPS);
  });

  it('starts setup mode at the profile step', () => {
    expect(visibleWizardSteps({ mode: 'setup', shape: 'workspace' })).toEqual(['profile', 'ready']);
  });
});
