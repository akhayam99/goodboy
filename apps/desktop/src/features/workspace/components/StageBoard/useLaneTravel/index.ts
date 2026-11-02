import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { DURATION_BASE_MS, prefersReducedMotion } from '@goodboy/ui';
import type { Session } from '@goodboy/types';

const LANE_TRAVEL_MAX_CARDS = 12;

type Params = {
  readonly byStage: ReadonlyMap<string, ReadonlyArray<Session>>;
  readonly resetKey: string;
  readonly containerRef: RefObject<HTMLElement | null>;
};

type TravelState = {
  readonly resetKey: string;
  readonly laneOf: ReadonlyMap<string, string>;
  readonly travelers: ReadonlySet<string>;
  readonly epoch: number;
};

type Box = {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
};

type SameLanesParams = {
  readonly left: ReadonlyMap<string, string>;
  readonly right: ReadonlyMap<string, string>;
};

type TravelersParams = {
  readonly previous: ReadonlyMap<string, string>;
  readonly current: ReadonlyMap<string, string>;
};

type OverlapParams = {
  readonly box: Box;
  readonly frame: Box;
};

const NO_TRAVELERS: ReadonlySet<string> = new Set();

const sameLanes = ({ left, right }: SameLanesParams): boolean =>
  left.size === right.size && [...left].every(([id, lane]) => right.get(id) === lane);

const travelersOf = ({ previous, current }: TravelersParams): ReadonlySet<string> => {
  if (previous.size >= LANE_TRAVEL_MAX_CARDS || current.size >= LANE_TRAVEL_MAX_CARDS) {
    return NO_TRAVELERS;
  }
  return new Set(
    [...current]
      .filter(([id, lane]) => {
        const before = previous.get(id);
        return before !== undefined && before !== lane;
      })
      .map(([id]) => id),
  );
};

const overlaps = ({ box, frame }: OverlapParams): boolean =>
  box.top < frame.bottom &&
  box.bottom > frame.top &&
  box.left < frame.right &&
  box.right > frame.left;

type MeasureParams = {
  readonly container: HTMLElement;
};

const measureCards = ({ container }: MeasureParams): ReadonlyMap<string, Box> => {
  const measured = new Map<string, Box>();
  container.querySelectorAll<HTMLElement>('[data-select-id]').forEach((card) => {
    const id = card.dataset.selectId;
    if (id !== undefined) {
      measured.set(id, card.getBoundingClientRect());
    }
  });
  return measured;
};

export const useLaneTravel = ({ byStage, resetKey, containerRef }: Params): ReadonlySet<string> => {
  const laneOf = useMemo(
    () =>
      new Map(
        [...byStage].flatMap(([stage, sessions]) =>
          sessions.map((session): [string, string] => [session.id, stage]),
        ),
      ),
    [byStage],
  );
  const [state, setState] = useState<TravelState>(() => ({
    resetKey,
    laneOf,
    travelers: NO_TRAVELERS,
    epoch: 0,
  }));
  if (state.resetKey !== resetKey || !sameLanes({ left: state.laneOf, right: laneOf })) {
    const isSteady = state.resetKey === resetKey && !prefersReducedMotion();
    setState({
      resetKey,
      laneOf,
      travelers: isSteady ? travelersOf({ previous: state.laneOf, current: laneOf }) : NO_TRAVELERS,
      epoch: state.epoch + 1,
    });
  }
  const { travelers, epoch } = state;
  const boxes = useRef<ReadonlyMap<string, Box>>(new Map());
  const animatedEpoch = useRef(0);
  const isTracking = laneOf.size < LANE_TRAVEL_MAX_CARDS;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container === null || !isTracking) {
      boxes.current = new Map();
      return;
    }
    const frame = container.getBoundingClientRect();
    const measured = measureCards({ container });
    if (animatedEpoch.current !== epoch) {
      animatedEpoch.current = epoch;
      container.querySelectorAll<HTMLElement>('[data-select-id]').forEach((card) => {
        const id = card.dataset.selectId;
        const before = id === undefined ? undefined : boxes.current.get(id);
        const after = id === undefined ? undefined : measured.get(id);
        if (
          id === undefined ||
          before === undefined ||
          after === undefined ||
          !travelers.has(id) ||
          !overlaps({ box: before, frame }) ||
          !overlaps({ box: after, frame }) ||
          typeof card.animate !== 'function'
        ) {
          return;
        }
        card.animate(
          [
            { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)` },
            { transform: 'none' },
          ],
          { duration: DURATION_BASE_MS, easing: 'ease-out' },
        );
      });
    }
    boxes.current = measured;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || !isTracking) {
      return;
    }
    const remeasure = () => {
      boxes.current = measureCards({ container });
    };
    container.addEventListener('scroll', remeasure, { capture: true, passive: true });
    return () => container.removeEventListener('scroll', remeasure, { capture: true });
  }, [containerRef, isTracking]);

  return travelers;
};
