// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  NUMBERED_WIZARD_STEPS,
  WIZARD_STEPS,
  firstWizardStep,
  isNumberedStepId,
  numberedStepOf,
  resumeStep,
  savedWizardStepOf,
  visibleWizardSteps,
} from './wizardSteps';

describe('visibleWizardSteps', () => {
  it('runs the three steps on a first run, with Tools as a side step after them', () => {
    expect(visibleWizardSteps({ mode: 'full', start: null })).toEqual([
      'agents',
      'workspace',
      'first-session',
      'tools',
    ]);
  });

  it('keeps the same steps on a resume', () => {
    expect(visibleWizardSteps({ mode: 'setup', start: 'workspace' })).toEqual(WIZARD_STEPS);
  });

  it('opens a single step on its own', () => {
    expect(visibleWizardSteps({ mode: 'single', start: 'tools' })).toEqual(['tools']);
  });
});

describe('firstWizardStep', () => {
  it('starts a first run on Agents, with no splash before it', () => {
    expect(firstWizardStep({ mode: 'full', start: null })).toBe('agents');
  });

  it('starts a resume at the step it names', () => {
    expect(firstWizardStep({ mode: 'setup', start: 'workspace' })).toBe('workspace');
  });

  it('starts a resume that names no step at Agents', () => {
    expect(firstWizardStep({ mode: 'setup', start: null })).toBe('agents');
  });
});

describe('resumeStep', () => {
  it('resumes at the last step written', () => {
    expect(resumeStep({ saved: 'first-session', hasWorkspace: true })).toBe('first-session');
  });

  it('starts at Agents when no step was ever written', () => {
    expect(resumeStep({ saved: null, hasWorkspace: false })).toBe('agents');
  });

  it('falls back to Workspace when the saved step needs a workspace that is gone', () => {
    expect(resumeStep({ saved: 'first-session', hasWorkspace: false })).toBe('workspace');
    expect(resumeStep({ saved: 'agents', hasWorkspace: false })).toBe('agents');
  });
});

describe('savedWizardStepOf', () => {
  it('keeps a step of the new list as it is', () => {
    expect(savedWizardStepOf({ raw: 'agents' })).toBe('agents');
    expect(savedWizardStepOf({ raw: 'workspace' })).toBe('workspace');
    expect(savedWizardStepOf({ raw: 'first-session' })).toBe('first-session');
  });

  it('moves a step saved on the old Tools step to First session', () => {
    expect(savedWizardStepOf({ raw: 'tools' })).toBe('first-session');
  });

  it('moves a step saved on the old Welcome splash to Agents', () => {
    expect(savedWizardStepOf({ raw: 'welcome' })).toBe('agents');
  });

  it('reads nothing and anything unknown as no saved step', () => {
    expect(savedWizardStepOf({ raw: null })).toBeNull();
    expect(savedWizardStepOf({ raw: '' })).toBeNull();
    expect(savedWizardStepOf({ raw: 'code-host' })).toBeNull();
  });
});

describe('numberedStepOf', () => {
  it('keeps the Tools side step under First session in the stepper', () => {
    expect(numberedStepOf({ step: 'tools' })).toBe('first-session');
    expect(numberedStepOf({ step: 'workspace' })).toBe('workspace');
  });
});

describe('isNumberedStepId', () => {
  it('reads the three step ids and nothing else', () => {
    expect(WIZARD_STEPS.filter(isNumberedStepId)).toEqual(NUMBERED_WIZARD_STEPS);
    expect(isNumberedStepId('tools')).toBe(false);
    expect(isNumberedStepId('welcome')).toBe(false);
    expect(isNumberedStepId('')).toBe(false);
  });
});
