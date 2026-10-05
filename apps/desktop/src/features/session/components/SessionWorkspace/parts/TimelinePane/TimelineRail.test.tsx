// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TERMINAL_DIM } from '@goodboy/ui';
import type { RailJoin, RailRow, RailSegment } from '../../../../../workTreeModel/railGeometry';
import { TimelineRail } from './TimelineRail';

const railOf = ({
  segment,
  joins = [],
}: {
  readonly segment: RailSegment;
  readonly joins?: ReadonlyArray<RailJoin>;
}): RailRow => ({
  id: 'row',
  height: 32,
  segments: [segment],
  joins,
  markerColumn: 0,
  markerY: 16,
});

const MUTED_JOIN: RailJoin = {
  kind: 'branch',
  spineColumn: 0,
  laneColumn: 1,
  laneId: 'lane',
  identityIndex: 0,
  isMuted: true,
  dash: 'solid',
  anchorY: 16,
  path: 'M 8 16 L 24 0',
};

afterEach(cleanup);

describe('TimelineRail', () => {
  it('keeps every lane stroke on its own colour at full strength', () => {
    const { container } = render(
      <TimelineRail
        width={32}
        rail={railOf({
          segment: {
            column: 1,
            laneId: 'lane',
            identityIndex: 0,
            isMuted: false,
            dash: 'solid',
            fromY: 0,
            toY: 32,
          },
        })}
      />,
    );
    const line = container.querySelector('line');

    expect(line?.getAttribute('stroke')).toBe('var(--color-identity-1)');
    expect(line?.getAttribute('class') ?? '').not.toContain('opacity');
  });

  it('recedes a muted lane without changing the hue that names its run', () => {
    const { container } = render(
      <TimelineRail
        width={32}
        rail={railOf({
          segment: {
            column: 1,
            laneId: 'lane',
            identityIndex: 0,
            isMuted: true,
            dash: 'solid',
            fromY: 0,
            toY: 32,
          },
          joins: [MUTED_JOIN],
        })}
      />,
    );
    const line = container.querySelector('line');
    const join = container.querySelector('path');

    expect(line?.getAttribute('stroke')).toBe('var(--color-identity-1)');
    expect(line?.getAttribute('class')).toContain(TERMINAL_DIM);
    expect(join?.getAttribute('stroke')).toBe('var(--color-identity-1)');
    expect(join?.getAttribute('class')).toContain(TERMINAL_DIM);
  });
});

describe('TimelineRail row edges', () => {
  const segmentOf = (overrides: Partial<RailSegment>): RailSegment => ({
    column: 0,
    laneId: null,
    identityIndex: null,
    isMuted: false,
    dash: 'solid',
    fromY: 0,
    toY: 32,
    ...overrides,
  });

  const spanOfLine = () => {
    const line = screen.getByTestId('timeline-rail-segment');
    return { from: Number(line.getAttribute('y1')), to: Number(line.getAttribute('y2')) };
  };

  it('overlaps a solid line into both neighbouring rows so stacked rows never leave a hairline', () => {
    const { container } = render(
      <TimelineRail width={32} rail={railOf({ segment: segmentOf({}) })} />,
    );
    const { from, to } = spanOfLine();

    expect(from).toBeLessThan(0);
    expect(to).toBeGreaterThan(32);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('overflow-visible');
  });

  it('overlaps an identity lane the same way as the grey spine', () => {
    render(
      <TimelineRail
        width={32}
        rail={railOf({ segment: segmentOf({ column: 1, laneId: 'lane', identityIndex: 0 }) })}
      />,
    );
    const { from, to } = spanOfLine();

    expect(from).toBeLessThan(0);
    expect(to).toBeGreaterThan(32);
  });

  it('ends exactly on the marker when the line stops inside the row', () => {
    render(
      <TimelineRail width={32} rail={railOf({ segment: segmentOf({ fromY: 16, toY: 32 }) })} />,
    );

    expect(spanOfLine().from).toBe(16);
  });

  it('keeps a dashed line inside its row so the dash pattern never doubles', () => {
    render(<TimelineRail width={32} rail={railOf({ segment: segmentOf({ dash: 'dashed' }) })} />);

    expect(spanOfLine()).toEqual({ from: 0, to: 32 });
  });

  it('draws lines and elbows with one rendering so they land on the same pixels', () => {
    const { container } = render(
      <TimelineRail
        width={32}
        rail={railOf({
          segment: segmentOf({ fromY: 16, toY: 32 }),
          joins: [{ ...MUTED_JOIN, isMuted: false }],
        })}
      />,
    );

    expect(container.querySelectorAll('[shape-rendering]')).toHaveLength(0);
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(screen.queryByTestId('timeline-rail-join-bleed')).toBeNull();
  });
});
