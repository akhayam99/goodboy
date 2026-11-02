// @vitest-environment happy-dom

import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { brandId, type Session, type SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { useLaneTravel } from '.';

const LANE_TRAVEL_MAX_CARDS = 12;

type HarnessProps = {
  readonly byStage: ReadonlyMap<string, ReadonlyArray<Session>>;
  readonly resetKey?: string;
};

type LanesParams = {
  readonly lanes: Readonly<Record<string, ReadonlyArray<string>>>;
};

const LANE_ORDER = ['building', 'attention', 'done'];

const sessionOf = ({ id }: { readonly id: string }): Session =>
  aSession({ id: brandId<SessionId>({ value: id }) });

const lanesOf = ({ lanes }: LanesParams): ReadonlyMap<string, ReadonlyArray<Session>> =>
  new Map(Object.entries(lanes).map(([lane, ids]) => [lane, ids.map((id) => sessionOf({ id }))]));

const Harness = ({ byStage, resetKey = 'all' }: HarnessProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useLaneTravel({ byStage, resetKey, containerRef: ref });
  return (
    <div ref={ref}>
      {[...byStage].flatMap(([lane, sessions]) =>
        sessions.map((session, slot) => (
          <article key={session.id} data-select-id={session.id} data-lane={lane} data-slot={slot} />
        )),
      )}
    </div>
  );
};

const animate = vi.fn();

const stubReducedMotion = ({ isReduced }: { readonly isReduced: boolean }) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isReduced && query.includes('reduce'),
    media: query,
  }));
};

beforeEach(() => {
  animate.mockReset();
  stubReducedMotion({ isReduced: false });
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const lane = this.dataset.lane;
    if (lane === undefined) {
      return new DOMRect(0, 0, 1000, 1000);
    }
    const left = LANE_ORDER.indexOf(lane) * 300;
    const top = Number(this.dataset.slot) * 100;
    return new DOMRect(left, top, 280, 90);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useLaneTravel', () => {
  it('slides a card from its old place to its new one when it changes lane', () => {
    const { rerender } = render(
      <Harness byStage={lanesOf({ lanes: { building: ['a', 'b'], attention: ['c'] } })} />,
    );

    rerender(<Harness byStage={lanesOf({ lanes: { building: ['b'], attention: ['c', 'a'] } })} />);

    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledWith(
      [{ transform: 'translate(-300px, -100px)' }, { transform: 'none' }],
      { duration: 200, easing: 'ease-out' },
    );
  });

  it('does not travel a card that only entered or left', () => {
    const { rerender } = render(<Harness byStage={lanesOf({ lanes: { building: ['a'] } })} />);

    rerender(<Harness byStage={lanesOf({ lanes: { building: ['a', 'b'] } })} />);
    rerender(<Harness byStage={lanesOf({ lanes: { building: ['b'] } })} />);

    expect(animate).not.toHaveBeenCalled();
  });

  it('does not travel at or above the card cap', () => {
    const ids = Array.from({ length: LANE_TRAVEL_MAX_CARDS }, (_, index) => `s${index}`);
    const { rerender } = render(
      <Harness byStage={lanesOf({ lanes: { building: ids, attention: [] } })} />,
    );

    rerender(
      <Harness
        byStage={lanesOf({ lanes: { building: ids.slice(1), attention: ids.slice(0, 1) } })}
      />,
    );

    expect(animate).not.toHaveBeenCalled();
  });

  it('does not travel when the board resets', () => {
    const { rerender } = render(
      <Harness byStage={lanesOf({ lanes: { building: ['a'], attention: [] } })} resetKey="one" />,
    );

    rerender(
      <Harness byStage={lanesOf({ lanes: { building: [], attention: ['a'] } })} resetKey="two" />,
    );

    expect(animate).not.toHaveBeenCalled();
  });

  it('does not travel with reduced motion', () => {
    stubReducedMotion({ isReduced: true });
    const { rerender } = render(
      <Harness byStage={lanesOf({ lanes: { building: ['a'], attention: [] } })} />,
    );

    rerender(<Harness byStage={lanesOf({ lanes: { building: [], attention: ['a'] } })} />);

    expect(animate).not.toHaveBeenCalled();
  });

  it('does not travel a card whose old place was outside the board', () => {
    const { rerender } = render(
      <Harness byStage={lanesOf({ lanes: { building: ['a'], attention: [] } })} />,
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.dataset.lane === undefined
        ? new DOMRect(0, 0, 100, 100)
        : new DOMRect(500, 500, 280, 90);
    });

    rerender(<Harness byStage={lanesOf({ lanes: { building: [], attention: ['a'] } })} />);

    expect(animate).not.toHaveBeenCalled();
  });
});
