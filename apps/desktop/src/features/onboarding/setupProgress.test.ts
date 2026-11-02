// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { setupProgress } from './setupProgress';
import { WIZARD_STEP_LABEL } from './OnboardingWizard/wizardSteps';

describe('setupProgress', () => {
  it('counts the three steps the stepper shows, with their names', () => {
    const progress = setupProgress({ completed: new Set(['agents']) });

    expect(progress.rows.map((row) => row.title)).toEqual(Object.values(WIZARD_STEP_LABEL));
    expect(progress.count).toBe('1 of 3');
    expect(progress.done).toBe(1);
    expect(progress.total).toBe(3);
    expect(progress.next).toBe('workspace');
    expect(progress.isDone).toBe(false);
  });

  it('leaves About you out of the count', () => {
    const progress = setupProgress({ completed: new Set(['agents', 'profile']) });

    expect(progress.count).toBe('1 of 3');
    expect(progress.rows.some((row) => row.id === 'agents' && row.isDone)).toBe(true);
  });

  it('has no Tools row, so a saved tools entry counts for nothing', () => {
    const progress = setupProgress({ completed: new Set(['agents', 'workspace', 'tools']) });

    expect(progress.count).toBe('2 of 3');
    expect(progress.next).toBe('first-session');
  });

  it('is done once all three are done', () => {
    const progress = setupProgress({
      completed: new Set(['agents', 'workspace', 'first-session']),
    });

    expect(progress.isDone).toBe(true);
    expect(progress.next).toBeNull();
    expect(progress.count).toBe('3 of 3');
  });
});
