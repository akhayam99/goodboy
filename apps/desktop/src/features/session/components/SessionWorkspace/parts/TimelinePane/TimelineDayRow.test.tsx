// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { runIdentity } from '../../../../timeline/runIdentity';
import { TimelineDayRow } from './TimelineDayRow';
import { dayLabel } from './dayLabel';

afterEach(cleanup);

describe('TimelineDayRow', () => {
  it('puts the day label in the left gutter the timestamps already use', () => {
    const { container } = render(<TimelineDayRow label="Yesterday" identity={null} />);

    const grid = container.firstElementChild;
    expect(grid?.className).toContain('grid-cols-[52px_minmax(0,1fr)]');
    expect(grid?.firstElementChild?.textContent).toBe('Yesterday');
  });

  it('draws a rule across the width to the right of the label', () => {
    const { container } = render(<TimelineDayRow label="11 Aug" identity={null} />);

    const rule = container.querySelector('.h-px');
    expect(rule).not.toBeNull();
    expect(screen.getByText('11 Aug').contains(rule)).toBe(false);
  });

  it('carries the run colour through a divider that splits one run', () => {
    const identity = runIdentity({ runId: 'run-42' });
    const { container } = render(<TimelineDayRow label="Yesterday" identity={identity} />);

    expect(container.querySelector(`.${identity.spine}`)).not.toBeNull();
  });
});

describe('dayLabel', () => {
  const now = new Date('2026-08-18T10:00:00Z');

  it('labels nothing for today, because the newest group needs no label', () => {
    expect(dayLabel({ at: '2026-08-18T08:00:00Z', now })).toBeNull();
  });

  it('names yesterday and dates anything older', () => {
    expect(dayLabel({ at: '2026-08-17T08:00:00Z', now })).toBe('Yesterday');
    expect(dayLabel({ at: '2026-08-11T08:00:00Z', now })).not.toBeNull();
    expect(dayLabel({ at: '2026-08-11T08:00:00Z', now })).not.toBe('Yesterday');
  });
});
