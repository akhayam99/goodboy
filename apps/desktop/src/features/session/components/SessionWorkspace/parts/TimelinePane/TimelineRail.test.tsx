// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('TimelineRail lane hit area', () => {
  const laneSegment: RailSegment = {
    column: 1,
    laneId: 'lane:run:one',
    identityIndex: 2,
    isMuted: false,
    dash: 'solid',
    fromY: 4,
    toY: 28,
  };

  it('opens the run from a click on its lane, over the lane column only', () => {
    const open = vi.fn();
    render(
      <TimelineRail
        width={48}
        rail={railOf({ segment: laneSegment })}
        lanes={{
          targetFor: ({ laneId }) =>
            laneId === 'lane:run:one' ? { laneId, title: 'Harden the webhook', open } : null,
        }}
      />,
    );
    const hit = screen.getByTestId('timeline-lane-hit');

    expect(hit.getAttribute('aria-label')).toBe('Open workflow: Harden the webhook');
    expect(hit.style.left).toBe('18px');
    expect(hit.style.top).toBe('4px');
    expect(hit.style.height).toBe('24px');
    fireEvent.click(hit);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('draws no hit area for a lane that opens nothing, nor for the spine', () => {
    render(
      <TimelineRail
        width={48}
        rail={{
          ...railOf({ segment: laneSegment }),
          segments: [laneSegment, { ...laneSegment, column: 0, laneId: null, identityIndex: null }],
        }}
        lanes={{ targetFor: () => null }}
      />,
    );

    expect(screen.queryByTestId('timeline-lane-hit')).toBeNull();
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
