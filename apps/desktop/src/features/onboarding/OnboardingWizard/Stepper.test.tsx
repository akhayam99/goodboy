import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Stepper } from './Stepper';
import { WIZARD_STEPS } from './wizardSteps';

afterEach(cleanup);

describe('Stepper', () => {
  it('marks steps behind the current one done and steps ahead pending', () => {
    const { container } = render(<Stepper current="projects" steps={WIZARD_STEPS} />);
    const dots = container.querySelectorAll('[data-state]');
    expect(dots).toHaveLength(6);
    expect(dots[2]?.getAttribute('data-state')).toBe('done');
    expect(dots[3]?.getAttribute('data-state')).toBe('current');
    expect(dots[4]?.getAttribute('data-state')).toBe('pending');
  });

  it('renders position only, never text', () => {
    const { container } = render(<Stepper current="shape" steps={WIZARD_STEPS} />);
    expect(container.textContent).toBe('');
  });

  it('uses the supplied step list for setup mode', () => {
    const { container } = render(<Stepper current="ready" steps={['profile', 'ready']} />);
    const dots = container.querySelectorAll('[data-state]');
    expect(dots).toHaveLength(2);
    expect(dots[0]?.getAttribute('data-state')).toBe('done');
    expect(dots[1]?.getAttribute('data-state')).toBe('current');
  });
});
