// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { RailRow, RailSegment } from '../../../../timeline/railGeometry';
import { TimelineRail } from './TimelineRail';

const RECEDED_RUN_STROKE =
  'color-mix(in oklab, var(--color-run-1) var(--rail-strength-receded), var(--color-background))';

const railOf = ({ segment }: { readonly segment: RailSegment }): RailRow => ({
  id: 'row',
  height: 32,
  segments: [segment],
  joins: [],
  markerColumn: 0,
  markerY: 16,
});

afterEach(cleanup);

describe('TimelineRail', () => {
  it('dims a receded stroke by mixing its colour toward the opaque surface', () => {
    const { container } = render(
      <TimelineRail
        width={32}
        rail={railOf({
          segment: {
            column: 1,
            identityIndex: 0,
            dash: 'solid',
            strength: 'receded',
            fade: [],
            fromY: 0,
            toY: 32,
          },
        })}
      />,
    );
    const line = container.querySelector('line');

    expect(line?.getAttribute('stroke')).toBe(RECEDED_RUN_STROKE);
    expect(line?.getAttribute('class') ?? '').not.toContain('opacity');
    expect(line?.hasAttribute('opacity')).toBe(false);
  });

  it('samples a colour fade over the whole row without alpha stops', () => {
    const { container } = render(
      <TimelineRail
        width={32}
        rail={railOf({
          segment: {
            column: 0,
            identityIndex: null,
            dash: 'solid',
            strength: 'full',
            fade: [
              { offset: 0, recession: 0 },
              { offset: 0.65, recession: 0 },
              { offset: 1, recession: 1 },
            ],
            fromY: 16,
            toY: 32,
          },
        })}
      />,
    );
    const gradient = container.querySelector('linearGradient');
    const stops = Array.from(container.querySelectorAll('stop'));

    expect(gradient?.getAttribute('y1')).toBe('0');
    expect(gradient?.getAttribute('y2')).toBe('32');
    expect(stops.some((stop) => stop.getAttribute('stop-color')?.startsWith('color-mix('))).toBe(
      true,
    );
    expect(stops.every((stop) => !stop.hasAttribute('stop-opacity'))).toBe(true);
  });
});
