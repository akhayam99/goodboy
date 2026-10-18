// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  NUMBERED_WIZARD_STEPS,
  WIZARD_STEPS,
  firstWizardStep,
  isNumberedStepId,
  resumeStep,
  visibleWizardSteps,
} from './wizardSteps';

describe('visibleWizardSteps', () => {
  it('runs Welcome and the four steps on a first run', () => {
    expect(visibleWizardSteps({ mode: 'full', start: null })).toEqual([
      'welcome',
      'agents',
      'workspace',
      'tools',
      'first-session',
    ]);
  });

  it('keeps the four steps on a resume, with no Welcome to go back to', () => {
    expect(visibleWizardSteps({ mode: 'setup', start: 'tools' })).toEqual(NUMBERED_WIZARD_STEPS);
  });

  it('never drops Tools, whatever the workspace holds', () => {
    expect(visibleWizardSteps({ mode: 'full', start: null })).toContain('tools');
    expect(visibleWizardSteps({ mode: 'setup', start: null })).toContain('tools');
  });

  it('opens a single step on its own', () => {
    expect(visibleWizardSteps({ mode: 'single', start: 'tools' })).toEqual(['tools']);
  });
});

describe('firstWizardStep', () => {
  it('starts a first run on Welcome', () => {
    expect(firstWizardStep({ mode: 'full', start: null })).toBe('welcome');
  });

  it('starts a resume at the step it names', () => {
    expect(firstWizardStep({ mode: 'setup', start: 'workspace' })).toBe('workspace');
  });

  it('starts a resume that names no step at Tools', () => {
    expect(firstWizardStep({ mode: 'setup', start: null })).toBe('tools');
  });
});

describe('resumeStep', () => {
  it('resumes at the last step written', () => {
    expect(resumeStep({ saved: 'tools', hasWorkspace: true })).toBe('tools');
  });

  it('starts at Agents when no step was ever written', () => {
    expect(resumeStep({ saved: null, hasWorkspace: false })).toBe('agents');
  });

  it('falls back to Workspace when the saved step needs a workspace that is gone', () => {
    expect(resumeStep({ saved: 'first-session', hasWorkspace: false })).toBe('workspace');
    expect(resumeStep({ saved: 'agents', hasWorkspace: false })).toBe('agents');
  });
});

describe('isNumberedStepId', () => {
  it('reads the four step ids and nothing else', () => {
    expect(WIZARD_STEPS.filter(isNumberedStepId)).toEqual(NUMBERED_WIZARD_STEPS);
    expect(isNumberedStepId('code-host')).toBe(false);
    expect(isNumberedStepId('')).toBe(false);
  });
});
