// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { glanceOf } from '../../glance/glanceOf';
import { RunGlanceLine } from '.';

afterEach(cleanup);

const mount = ({ spend }: { readonly spend: string | null }) =>
  render(
    <RunGlanceLine
      id="agent-ledger-core"
      glance={glanceOf({ state: 'working', sentence: '1 of 3 steps' })}
      spend={spend}
      settings={<span>Model chips</span>}
    />,
  );

describe('RunGlanceLine', () => {
  it('draws the state word, the sentence and the spend of the limit', () => {
    mount({ spend: '$1.20 of $5.00' });

    expect(screen.getByText('Working').textContent).toBe('Working');
    expect(screen.getByText('1 of 3 steps').textContent).toBe('1 of 3 steps');
    expect(screen.getByText('$1.20 of $5.00').textContent).toBe('$1.20 of $5.00');
  });

  it('draws no spend when there is nothing to say', () => {
    mount({ spend: null });

    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('keeps the chips behind Settings and opens them inline', () => {
    const { container } = mount({ spend: null });
    const button = screen.getByRole('button', { name: 'Settings' });
    const panel = container.querySelector('#run-settings-agent-ledger-core');

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(panel?.getAttribute('data-open')).toBe('false');

    fireEvent.click(button);

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.getAttribute('data-open')).toBe('true');
    expect(panel?.textContent).toBe('Model chips');
  });
});
