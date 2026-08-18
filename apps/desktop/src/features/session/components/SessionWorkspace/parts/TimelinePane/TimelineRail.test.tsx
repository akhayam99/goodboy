// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { RailRow, RailSegment } from '../../../../timeline/railGeometry';
import { TimelineRail } from './TimelineRail';

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
  it('keeps every lane stroke on its own colour at full strength', () => {
    const { container } = render(
      <TimelineRail
        width={32}
        rail={railOf({
          segment: {
            column: 1,
            identityIndex: 0,
            dash: 'solid',
            fromY: 0,
            toY: 32,
          },
        })}
      />,
    );
    const line = container.querySelector('line');

    expect(line?.getAttribute('stroke')).toBe('var(--color-run-1)');
    expect(line?.getAttribute('class') ?? '').not.toContain('opacity');
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
            fromY: 16,
            toY: 32,
          },
        })}
      />,
    );
    const line = container.querySelector('line');

    expect(container.querySelector('defs')).toBeNull();
    expect(container.querySelector('linearGradient')).toBeNull();
    expect(line?.getAttribute('stroke')).toBe('var(--color-border)');
    expect(line?.getAttribute('class') ?? '').not.toContain('opacity');
  });
});
