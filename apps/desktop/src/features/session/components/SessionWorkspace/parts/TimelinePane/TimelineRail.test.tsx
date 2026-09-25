// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TERMINAL_DIM } from '@goodboy/ui';
import type { RailJoin, RailRow, RailSegment } from '../../../../../workTreeModel/railGeometry';
import { TimelineRail, type TimelineLaneControl } from './TimelineRail';

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

  it('paints every stroke with one flat colour and no gradient machinery', () => {
    const { container } = render(
      <TimelineRail
        width={32}
        rail={railOf({
          segment: {
            column: 0,
            laneId: null,
            identityIndex: null,
            isMuted: false,
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

  const LANE_SEGMENT: RailSegment = {
    column: 1,
    laneId: 'lane',
    identityIndex: 0,
    isMuted: false,
    dash: 'solid',
    fromY: 0,
    toY: 32,
  };

  const lanesOf = ({
    hoveredLaneId = null,
    open = vi.fn(),
    onHover = vi.fn(),
  }: {
    readonly hoveredLaneId?: string | null;
    readonly open?: () => void;
    readonly onHover?: TimelineLaneControl['onHover'];
  }): TimelineLaneControl => ({
    targetFor: ({ laneId }) =>
      laneId === 'lane' ? { laneId, title: 'Retry failed payments', open } : null,
    hoveredLaneId,
    onHover,
  });

  it('opens the run from anywhere on its lane and names it', () => {
    const open = vi.fn();
    const onHover = vi.fn();
    render(
      <TimelineRail
        width={32}
        rail={railOf({ segment: LANE_SEGMENT })}
        lanes={lanesOf({ open, onHover })}
      />,
    );
    const hit = screen.getByRole('button', { name: 'Open workflow: Retry failed payments' });

    expect(hit.getAttribute('tabindex')).toBe('-1');
    expect(hit.style.left).toBe('18px');
    expect(hit.style.width).toBe('12px');
    expect(hit.style.height).toBe('32px');

    fireEvent.mouseEnter(hit);
    expect(onHover).toHaveBeenLastCalledWith({ laneId: 'lane' });
    fireEvent.click(hit);
    expect(open).toHaveBeenCalledTimes(1);
    fireEvent.mouseLeave(hit);
    expect(onHover).toHaveBeenLastCalledWith({ laneId: null });
  });

  it('leaves the spine and lanes without a run as plain drawing', () => {
    render(
      <TimelineRail
        width={32}
        rail={railOf({ segment: { ...LANE_SEGMENT, laneId: 'stub' } })}
        lanes={lanesOf({})}
      />,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('thickens the hovered lane and washes its column', () => {
    const { container } = render(
      <TimelineRail
        width={32}
        rail={railOf({ segment: LANE_SEGMENT, joins: [MUTED_JOIN] })}
        lanes={lanesOf({ hoveredLaneId: 'lane' })}
      />,
    );

    expect(container.querySelector('line')?.getAttribute('stroke-width')).toBe('3');
    expect(container.querySelector('path')?.getAttribute('stroke-width')).toBe('3');
    expect(screen.getByTestId('timeline-lane-wash').getAttribute('height')).toBe('32');
  });

  it('keeps a lane at rest when another lane is hovered', () => {
    const { container } = render(
      <TimelineRail
        width={32}
        rail={railOf({ segment: LANE_SEGMENT })}
        lanes={lanesOf({ hoveredLaneId: 'other' })}
      />,
    );

    expect(container.querySelector('line')?.getAttribute('stroke-width')).toBe('2');
    expect(screen.queryByTestId('timeline-lane-wash')).toBeNull();
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

  it('runs a solid line one pixel past both row edges so rows never leave a hairline', () => {
    const { container } = render(
      <TimelineRail width={32} rail={railOf({ segment: segmentOf({}) })} />,
    );
    const line = screen.getByTestId('timeline-rail-segment');

    expect(line.getAttribute('y1')).toBe('-1');
    expect(line.getAttribute('y2')).toBe('33');
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('overflow-visible');
  });

  it('runs the identity lane past the row edges the same way as the grey spine', () => {
    render(
      <TimelineRail
        width={32}
        rail={railOf({ segment: segmentOf({ column: 1, laneId: 'lane', identityIndex: 0 }) })}
      />,
    );
    const line = screen.getByTestId('timeline-rail-segment');

    expect([line.getAttribute('y1'), line.getAttribute('y2')]).toEqual(['-1', '33']);
  });

  it('stops exactly at the marker when the line ends inside the row', () => {
    render(
      <TimelineRail width={32} rail={railOf({ segment: segmentOf({ fromY: 16, toY: 32 }) })} />,
    );
    const line = screen.getByTestId('timeline-rail-segment');

    expect([line.getAttribute('y1'), line.getAttribute('y2')]).toEqual(['16', '33']);
  });

  it('keeps a dashed line inside its row so the dash pattern never doubles', () => {
    render(<TimelineRail width={32} rail={railOf({ segment: segmentOf({ dash: 'dashed' }) })} />);
    const line = screen.getByTestId('timeline-rail-segment');

    expect([line.getAttribute('y1'), line.getAttribute('y2')]).toEqual(['0', '32']);
  });

  it('carries an elbow from the row above across the top edge', () => {
    render(
      <TimelineRail
        width={32}
        rail={railOf({
          segment: segmentOf({ fromY: 16, toY: 32 }),
          joins: [{ ...MUTED_JOIN, isMuted: false }],
        })}
      />,
    );
    const bleed = screen.getByTestId('timeline-rail-join-bleed');

    expect([bleed.getAttribute('x1'), bleed.getAttribute('y1'), bleed.getAttribute('y2')]).toEqual([
      '24',
      '-1',
      '0',
    ]);
  });
});
