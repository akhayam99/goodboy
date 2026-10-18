// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { setupProgress } from './setupProgress';
import { WIZARD_STEP_LABEL } from './OnboardingWizard/wizardSteps';

describe('setupProgress', () => {
  it('counts the four steps the stepper shows, with their names', () => {
    const progress = setupProgress({ completed: new Set(['agents', 'workspace']) });

    expect(progress.rows.map((row) => row.title)).toEqual(Object.values(WIZARD_STEP_LABEL));
    expect(progress.count).toBe('2 of 4');
    expect(progress.done).toBe(2);
    expect(progress.total).toBe(4);
    expect(progress.fraction).toBe(0.5);
    expect(progress.next).toBe('tools');
    expect(progress.isDone).toBe(false);
  });

  it('leaves About you out of the count', () => {
    const progress = setupProgress({ completed: new Set(['agents', 'profile']) });

    expect(progress.count).toBe('1 of 4');
    expect(progress.rows.some((row) => row.id === 'agents' && row.isDone)).toBe(true);
  });

  it('marks Tools as the one optional row', () => {
    const progress = setupProgress({ completed: new Set() });

    expect(progress.rows.filter((row) => row.isOptional).map((row) => row.id)).toEqual(['tools']);
  });

  it('is done once all four are done', () => {
    const progress = setupProgress({
      completed: new Set(['agents', 'workspace', 'tools', 'first-session']),
    });

    expect(progress.isDone).toBe(true);
    expect(progress.next).toBeNull();
    expect(progress.count).toBe('4 of 4');
  });
});
