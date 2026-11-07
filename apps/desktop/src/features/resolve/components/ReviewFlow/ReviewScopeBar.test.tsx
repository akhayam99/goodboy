// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ReviewScopeBar } from './ReviewScopeBar';

afterEach(cleanup);

const COUNTS = { all: 3, notes: 0, host: 3 };

type BarParams = {
  readonly open: number;
  readonly resolved: number;
  readonly needYou?: number;
};

const renderBar = ({ open, resolved, needYou = 0 }: BarParams) =>
  render(
    <ReviewScopeBar
      scope="branch"
      onScope={vi.fn()}
      state="open"
      onState={vi.fn()}
      counts={COUNTS}
      stateCounts={{ open, resolved, needYou }}
      hostLabel="GitHub"
    />,
  );

describe('ReviewScopeBar', () => {
  it('shows Open and Resolved with counts from the first thread on', () => {
    const { container } = renderBar({ open: 1, resolved: 0 });
    expect(container.textContent).toContain('Open1');
    expect(container.textContent).toContain('Resolved0');
  });

  it('hides the switch with no thread', () => {
    const { container } = renderBar({ open: 0, resolved: 0 });
    expect(container.querySelector('[data-slot="review-scope-bar"]')).toBeNull();
  });

  it('warms the Open count when a thread needs you', () => {
    const { container } = renderBar({ open: 5, resolved: 12, needYou: 2 });
    expect(container.textContent).toContain('Open5');
    expect(container.textContent).toContain('Resolved12');
    expect(container.querySelector('.text-warning')?.textContent).toBe('5');
  });
});
