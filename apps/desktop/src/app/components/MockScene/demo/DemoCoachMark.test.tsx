// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { DemoCoachMark, type CoachMark } from './DemoCoachMark';
import type { DemoRect } from './director/demoProtocol';

const BOUNDS = { width: 1000, height: 600 };
const WARNING = 'Follow the outlined control first.';

type CoachParams = {
  readonly rect?: DemoRect;
  readonly pulse?: number;
  readonly hintId?: string;
};

const coachOf = ({
  rect = { x: 100, y: 100, width: 40, height: 24 },
  pulse = 0,
  hintId = 'open',
}: CoachParams): CoachMark => ({
  hintId,
  copy: 'Open the plan',
  side: undefined,
  isSideLocked: false,
  rect,
  focus: null,
  opened: [],
  isDimmed: false,
  pulse,
});

type ViewParams = {
  readonly coach: CoachMark;
};

const view = ({ coach }: ViewParams) => (
  <DemoCoachMark coach={coach} scale={1} bounds={BOUNDS} isSpotlit={false} onHide={() => {}} />
);

const sideOf = (): string | null =>
  screen.getByRole('note', { name: 'Hint' }).getAttribute('data-side');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(56);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the demo coach mark', () => {
  it('says why a click was blocked for a moment, then goes back to the hint alone', () => {
    const { rerender } = render(view({ coach: coachOf({}) }));
    expect(screen.queryByText(WARNING)).toBeNull();
    rerender(view({ coach: coachOf({ pulse: 1 }) }));
    expect(screen.getByText(WARNING)).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender(view({ coach: coachOf({ pulse: 2 }) }));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText(WARNING)).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByText(WARNING)).toBeNull();
  });

  it('does not warn when it first appears after an earlier blocked click', () => {
    render(view({ coach: coachOf({ pulse: 3 }) }));
    expect(screen.queryByText(WARNING)).toBeNull();
  });

  it('keeps its side while the control moves and that side still fits', () => {
    const { rerender } = render(view({ coach: coachOf({}) }));
    expect(sideOf()).toBe('right');
    const moved = { x: 600, y: 100, width: 40, height: 24 };
    rerender(view({ coach: coachOf({ rect: moved }) }));
    expect(sideOf()).toBe('right');
    cleanup();
    render(view({ coach: coachOf({ rect: moved, hintId: 'read' }) }));
    expect(sideOf()).toBe('bottom');
  });
});
