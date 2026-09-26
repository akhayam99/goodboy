import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Stepper, stepAnnouncement } from './Stepper';
import { WIZARD_STEPS } from './wizardSteps';

afterEach(cleanup);

describe('Stepper', () => {
  it('labels the five numbered steps and marks done, current and later', () => {
    const { container } = render(<Stepper current="code-host" steps={WIZARD_STEPS} />);
    const steps = container.querySelectorAll('[data-state]');
    expect(steps).toHaveLength(5);
    expect(steps[1]?.getAttribute('data-state')).toBe('done');
    expect(steps[2]?.getAttribute('data-state')).toBe('current');
    expect(steps[2]?.getAttribute('aria-current')).toBe('step');
    expect(steps[3]?.getAttribute('data-state')).toBe('later');
    expect(screen.getByText('Code host')).toBeDefined();
    expect(screen.getByText('First session')).toBeDefined();
  });

  it('shows every step as later on Welcome, so the top bar never pops in', () => {
    const { container } = render(<Stepper current="welcome" steps={WIZARD_STEPS} />);
    const states = Array.from(container.querySelectorAll('[data-state]')).map((node) =>
      node.getAttribute('data-state'),
    );
    expect(states).toEqual(['later', 'later', 'later', 'later', 'later']);
  });

  it('announces the position for screen readers', () => {
    expect(stepAnnouncement({ current: 'code-host', steps: WIZARD_STEPS })).toBe(
      'Step 3 of 5, Code host',
    );
    expect(stepAnnouncement({ current: 'welcome', steps: WIZARD_STEPS })).toBe('');
  });

  it('counts only the steps it is given', () => {
    const steps = ['welcome', 'providers', 'project', 'tasks', 'first-session'] as const;
    expect(stepAnnouncement({ current: 'tasks', steps })).toBe('Step 3 of 4, Tasks');
  });
});
