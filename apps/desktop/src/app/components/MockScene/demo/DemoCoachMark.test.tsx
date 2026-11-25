// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DemoCoachMark, type CoachMark } from './DemoCoachMark';
import type { DemoRect } from './director/demoProtocol';

const BOUNDS = { width: 1000, height: 600 };
const WARNING = 'Follow the outlined control first.';

type CoachParams = {
  readonly rect?: DemoRect;
  readonly pulse?: number;
  readonly hintId?: string;
  readonly isWarning?: boolean;
};

const coachOf = ({
  rect = { x: 100, y: 100, width: 40, height: 24 },
  pulse = 0,
  hintId = 'open',
  isWarning = false,
}: CoachParams): CoachMark => ({
  hintId,
  copy: 'Open the plan',
  side: undefined,
  isSideLocked: false,
  rect,
  focus: null,
  opened: [],
  chrome: [],
  isDimmed: false,
  pulse,
  isWarning,
});

type ViewParams = {
  readonly coach: CoachMark;
};

const view = ({ coach }: ViewParams) => (
  <DemoCoachMark
    coach={coach}
    scale={1}
    bounds={BOUNDS}
    isSpotlit={false}
    onHide={() => {}}
    onOffer={() => {}}
  />
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
  it('says why a click was blocked while the hint carries the warning, then the hint alone', () => {
    const { rerender } = render(view({ coach: coachOf({}) }));
    expect(screen.queryByText(WARNING)).toBeNull();
    rerender(view({ coach: coachOf({ pulse: 1, isWarning: true }) }));
    expect(screen.getByText(WARNING).textContent).toBe(WARNING);
    rerender(view({ coach: coachOf({ pulse: 1 }) }));
    expect(screen.queryByText(WARNING)).toBeNull();
  });

  it('warns as soon as it appears when the hint comes back on a blocked click', () => {
    render(view({ coach: coachOf({ pulse: 3, isWarning: true }) }));
    expect(screen.getByText(WARNING).textContent).toBe(WARNING);
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

  it('offers one demo button and presses it once per click', () => {
    const onOffer = vi.fn();
    render(
      <DemoCoachMark
        coach={{
          ...coachOf({}),
          offer: {
            eyebrow: 'Demo',
            title: 'Paste the example key',
            note: 'A demo key, it only works here',
            label: 'Paste example key',
          },
        }}
        scale={1}
        bounds={BOUNDS}
        isSpotlit={false}
        onHide={() => {}}
        onOffer={onOffer}
      />,
    );
    expect(screen.getByText('Demo').textContent).toBe('Demo');
    expect(screen.getByText('Paste the example key').textContent).toBe('Paste the example key');
    expect(screen.getByText('A demo key, it only works here').textContent).toBe(
      'A demo key, it only works here',
    );
    expect(screen.queryByText('Open the plan')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Paste example key' }));
    expect(onOffer).toHaveBeenCalledTimes(1);
  });

  it('shows no demo button on a plain step', () => {
    render(view({ coach: coachOf({}) }));
    expect(screen.queryByRole('button', { name: 'Paste example key' })).toBeNull();
  });
});
