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

  it('paints every stroke with one flat colour and no gradient machinery', () => {
    const { container } = render(
      <TimelineRail
        width={32}
        rail={railOf({
          segment: {
            column: 0,
            identityIndex: null,
            dash: 'solid',
            strength: 'full',
            fromY: 16,
            toY: 32,
          },
        })}
      />,
    );

    expect(container.querySelector('defs')).toBeNull();
    expect(container.querySelector('linearGradient')).toBeNull();
    expect(container.querySelector('line')?.getAttribute('stroke')).toBe('var(--color-border)');
  });
});
