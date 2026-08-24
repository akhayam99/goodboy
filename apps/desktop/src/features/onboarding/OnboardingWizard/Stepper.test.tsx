import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Stepper } from './Stepper';

afterEach(cleanup);

describe('Stepper', () => {
  it('marks steps behind the current one done and steps ahead pending', () => {
    const { container } = render(<Stepper current={3} steps={[0, 1, 2, 3, 4, 5]} />);
    const dots = container.querySelectorAll('[data-state]');
    expect(dots).toHaveLength(6);
    expect(dots[2]?.getAttribute('data-state')).toBe('done');
    expect(dots[3]?.getAttribute('data-state')).toBe('current');
    expect(dots[4]?.getAttribute('data-state')).toBe('pending');
  });

  it('renders position only, never text', () => {
    const { container } = render(<Stepper current={2} steps={[0, 1, 2, 3, 4, 5]} />);
    expect(container.textContent).toBe('');
  });

  it('uses the supplied step list for setup mode', () => {
    const { container } = render(<Stepper current={5} steps={[4, 5]} />);
    const dots = container.querySelectorAll('[data-state]');
    expect(dots).toHaveLength(2);
    expect(dots[0]?.getAttribute('data-state')).toBe('done');
    expect(dots[1]?.getAttribute('data-state')).toBe('current');
  });
});
