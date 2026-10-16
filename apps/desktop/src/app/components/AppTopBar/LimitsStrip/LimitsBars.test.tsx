import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { IsoDateTime, ProviderLimitWindow } from '@goodboy/types';
import { LimitsBars } from './LimitsBars';

const window = (patch: Partial<ProviderLimitWindow>): ProviderLimitWindow => ({
  kind: 'fiveHour',
  model: null,
  status: 'ok',
  usedFraction: 0,
  resetsAt: '2026-09-25T14:30:00.000Z' as IsoDateTime,
  ...patch,
});

const trackWidths = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-limits-track]')].map(
    (track) => (track.firstElementChild as HTMLElement).style.width,
  );

afterEach(() => {
  cleanup();
});

describe('LimitsBars', () => {
  it('draws one bar per provider, the tighter window, with no percent at or under 70%', () => {
    const { container } = render(
      <LimitsBars
        state="normal"
        isStale={false}
        windows={[
          window({ kind: 'fiveHour', status: 'ok', usedFraction: 0.1 }),
          window({ kind: 'weekly', status: 'ok', usedFraction: 0.42 }),
        ]}
      />,
    );

    expect(trackWidths(container)).toEqual(['42%']);
    expect(container.querySelector('[data-limits-track]')?.getAttribute('data-limits-track')).toBe(
      'weekly',
    );
    expect(container.querySelector('[data-limits-percent]')).toBeNull();
  });

  it('reads the percent in gray once the tighter window passes 70%', () => {
    const { container } = render(
      <LimitsBars
        state="warning"
        isStale={false}
        windows={[
          window({ kind: 'fiveHour', status: 'ok', usedFraction: 0.1 }),
          window({ kind: 'weeklyModel', model: 'Opus', status: 'warning', usedFraction: 0.82 }),
        ]}
      />,
    );

    expect(trackWidths(container)).toEqual(['82%']);
    expect(container.querySelector('[data-limits-percent]')?.textContent).toBe('82%');
  });

  it('takes a reached window as full, whatever its fraction says', () => {
    const { container } = render(
      <LimitsBars
        state="out"
        isStale={false}
        windows={[
          window({ kind: 'weeklyModel', model: 'Sonnet', status: 'ok', usedFraction: 0.3 }),
          window({ kind: 'weeklyModel', model: 'Opus', status: 'reached', usedFraction: 0.9 }),
        ]}
      />,
    );

    expect(trackWidths(container)).toEqual(['100%']);
    expect(container.querySelector('[data-limits-percent]')?.textContent).toBe('100%');
  });
});
