import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Stepper } from './Stepper';

afterEach(cleanup);

describe('Stepper', () => {
  it('marks the current step distinctly and uses checklist completion ahead of it', () => {
    const { container } = render(
      <Stepper current={4} steps={[0, 1, 2, 3, 4, 5, 6, 7]} completed={new Set(['codeHost'])} />,
    );
    const dots = container.querySelectorAll('[data-state]');
    expect(dots).toHaveLength(8);
    expect(dots[3]?.getAttribute('data-state')).toBe('done');
    expect(dots[4]?.getAttribute('data-state')).toBe('current');
    expect(dots[5]?.getAttribute('data-state')).toBe('pending');
    expect(dots[6]?.getAttribute('data-state')).toBe('done');
  });

  it('ticks the merged integrations step from either checklist id', () => {
    const { container } = render(
      <Stepper current={2} steps={[0, 1, 2, 3, 4, 5, 6, 7]} completed={new Set(['tools'])} />,
    );
    const dots = container.querySelectorAll('[data-state]');
    expect(dots[6]?.getAttribute('data-state')).toBe('done');
  });

  it('ticks the workspace and projects dots from the workspace id', () => {
    const { container } = render(
      <Stepper current={1} steps={[0, 1, 2, 3, 4, 5, 6, 7]} completed={new Set(['workspace'])} />,
    );
    const dots = container.querySelectorAll('[data-state]');
    expect(dots[2]?.getAttribute('data-state')).toBe('done');
    expect(dots[3]?.getAttribute('data-state')).toBe('done');
  });

  it('renders position only, never a fraction over the checklist set', () => {
    const { container } = render(
      <Stepper current={3} steps={[0, 1, 2, 3, 4, 5, 6, 7]} completed={new Set(['workspace'])} />,
    );
    expect(container.textContent).toBe('');
  });

  it('uses the supplied step list for setup mode', () => {
    const { container } = render(
      <Stepper current={5} steps={[4, 5, 6, 7]} completed={new Set()} />,
    );
    expect(container.querySelectorAll('[data-state]')).toHaveLength(4);
  });
});
