import { describe, expect, it } from 'vitest';
import {
  headerRevealOf,
  HIDE_THRESHOLD_PX,
  SHOW_THRESHOLD_PX,
  type HeaderRevealState,
} from './headerRevealOf';

const HEADER_PX = 160;

type StepParams = {
  readonly state: HeaderRevealState;
  readonly scrollTop: number;
  readonly isUserScroll?: boolean;
  readonly isFocusHeld?: boolean;
};

const step = ({ state, scrollTop, isUserScroll = true, isFocusHeld = false }: StepParams) =>
  headerRevealOf({ state, scrollTop, headerHeight: HEADER_PX, isUserScroll, isFocusHeld });

type WalkParams = {
  readonly from: HeaderRevealState;
  readonly tops: ReadonlyArray<number>;
  readonly isUserScroll?: boolean;
};

const walk = ({ from, tops, isUserScroll = true }: WalkParams): HeaderRevealState =>
  tops.reduce((state, scrollTop) => step({ state, scrollTop, isUserScroll }), from);

const SHOWN_AT_TOP: HeaderRevealState = { isShown: true, anchor: 0 };
const HIDDEN_READING: HeaderRevealState = { isShown: false, anchor: 600 };

describe('headerRevealOf', () => {
  it('keeps the header while the scroll is still inside its own height', () => {
    const state = walk({ from: SHOWN_AT_TOP, tops: [40, 80, 120, HEADER_PX] });
    expect(state.isShown).toBe(true);
  });

  it('hides the header once the reader scrolls down past its height by the threshold', () => {
    const state = walk({ from: SHOWN_AT_TOP, tops: [HEADER_PX, HEADER_PX + HIDE_THRESHOLD_PX] });
    expect(state.isShown).toBe(false);
  });

  it('waits for a deliberate scroll down before it hides the header', () => {
    const from: HeaderRevealState = { isShown: true, anchor: 400 };
    const almost = walk({ from, tops: [408, 416, 400 + HIDE_THRESHOLD_PX - 1] });
    expect(almost.isShown).toBe(true);
    const hidden = walk({ from: almost, tops: [400 + HIDE_THRESHOLD_PX] });
    expect(hidden.isShown).toBe(false);
  });

  it('brings the header back after a scroll up of the threshold, summed over small steps', () => {
    const almost = walk({ from: HIDDEN_READING, tops: [598, 596, 600 - SHOW_THRESHOLD_PX + 1] });
    expect(almost.isShown).toBe(false);
    const back = walk({ from: almost, tops: [600 - SHOW_THRESHOLD_PX] });
    expect(back.isShown).toBe(true);
  });

  it('does not flip on a bounce smaller than the threshold at either edge', () => {
    const hidden = walk({ from: HIDDEN_READING, tops: [900, 904, 897, 903, 899] });
    expect(hidden.isShown).toBe(false);
    const shown = walk({
      from: { isShown: true, anchor: 600 },
      tops: [612, 598, 620, 600],
    });
    expect(shown.isShown).toBe(true);
  });

  it('measures the scroll up from the lowest point the reader reached', () => {
    const state = walk({ from: HIDDEN_READING, tops: [700, 800, 795, 792] });
    expect(state).toEqual({ isShown: true, anchor: 792 });
  });

  it('shows the header at the top whatever moved the scroll', () => {
    expect(step({ state: HIDDEN_READING, scrollTop: 0, isUserScroll: false }).isShown).toBe(true);
    expect(step({ state: HIDDEN_READING, scrollTop: -24 }).isShown).toBe(true);
  });

  it('keeps the header while keyboard focus sits inside it', () => {
    const held = [400, 600, 900].reduce(
      (state, scrollTop) => step({ state, scrollTop, isFocusHeld: true }),
      SHOWN_AT_TOP,
    );
    expect(held.isShown).toBe(true);
  });

  it('never hides the header on a scroll the app made, and only moves the anchor', () => {
    const state = walk({ from: SHOWN_AT_TOP, tops: [520, 1400], isUserScroll: false });
    expect(state).toEqual({ isShown: true, anchor: 1400 });
    const after = step({ state, scrollTop: 1404 });
    expect(after.isShown).toBe(true);
  });

  it('never brings a hidden header back on a scroll the app made away from the top', () => {
    const state = walk({ from: HIDDEN_READING, tops: [300, 200], isUserScroll: false });
    expect(state).toEqual({ isShown: false, anchor: 200 });
  });
});
