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

const trackFills = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-limits-track]')].map(
    (track) => (track.firstElementChild as HTMLElement).className,
  );

afterEach(() => {
  cleanup();
});

describe('LimitsBars', () => {
  it('falls back to the weeklyModel window for the weekly track when there is no aggregate weekly window', () => {
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

    expect(trackWidths(container)).toEqual(['10%', '82%']);
  });

  it('picks the worst weeklyModel window for the weekly track when several are present', () => {
    const { container } = render(
      <LimitsBars
        state="out"
        isStale={false}
        windows={[
          window({ kind: 'weeklyModel', model: 'Sonnet', status: 'ok', usedFraction: 0.3 }),
          window({ kind: 'weeklyModel', model: 'Opus', status: 'reached', usedFraction: 1 }),
        ]}
      />,
    );

    expect(trackWidths(container)).toEqual(['0%', '100%']);
  });

  it('gives each bar the tone of its own window, not the chip state shared by both tracks', () => {
    const { container } = render(
      <LimitsBars
        state="out"
        isStale={false}
        windows={[
          window({ kind: 'fiveHour', status: 'ok', usedFraction: 0.05 }),
          window({ kind: 'weekly', status: 'reached', usedFraction: 1 }),
        ]}
      />,
    );

    const [fiveHourFill, weeklyFill] = trackFills(container);
    expect(fiveHourFill).toContain('bg-muted-foreground');
    expect(fiveHourFill).not.toContain('bg-danger');
    expect(weeklyFill).toContain('bg-danger');
  });

  it('uses the neutral fill when a track has no matching window', () => {
    const { container } = render(
      <LimitsBars
        state="warning"
        isStale={false}
        windows={[window({ kind: 'fiveHour', status: 'warning', usedFraction: 0.85 })]}
      />,
    );

    const [fiveHourFill, weeklyFill] = trackFills(container);
    expect(fiveHourFill).toContain('bg-warning');
    expect(weeklyFill).toContain('bg-muted-foreground');
  });
});
