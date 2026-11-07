import { describe, expect, it } from 'vitest';
import { headerRevealOf } from './headerRevealOf';
import type { HeaderRevealState } from './headerRevealState';

const LONG_RANGE = 4000;

type StepParams = {
  readonly state: HeaderRevealState;
  readonly scrollTop: number;
  readonly headerHeight?: number;
  readonly range?: number;
  readonly pending?: number;
  readonly isUserScroll?: boolean;
  readonly isFocusHeld?: boolean;
};

const step = ({
  state,
  scrollTop,
  headerHeight = 160,
  range = LONG_RANGE,
  pending = 0,
  isUserScroll = true,
  isFocusHeld = false,
}: StepParams) =>
  headerRevealOf({ state, scrollTop, range, headerHeight, pending, isUserScroll, isFocusHeld });

type WalkParams = {
  readonly from: HeaderRevealState;
  readonly tops: ReadonlyArray<number>;
  readonly headerHeight?: number;
  readonly isUserScroll?: boolean;
};

const walk = ({ from, tops, headerHeight, isUserScroll = true }: WalkParams) =>
  tops.reduce(
    (state, scrollTop) =>
      step({
        state,
        scrollTop,
        isUserScroll,
        ...(headerHeight === undefined ? {} : { headerHeight }),
      }),
    from,
  );

const AT_TOP: HeaderRevealState = { isShown: true, anchor: 0 };
const HIDDEN: HeaderRevealState = { isShown: false, anchor: 600 };

describe('headerRevealOf', () => {
  it('hides after 24px of deliberate scroll down, not before', () => {
    expect(walk({ from: AT_TOP, tops: [8, 16, 23] }).isShown).toBe(true);
    expect(walk({ from: AT_TOP, tops: [8, 16, 24] }).isShown).toBe(false);
  });

  it('hides at the same point whatever the header height', () => {
    const tops = [6, 12, 18, 24, 30];
    const short = walk({ from: AT_TOP, tops, headerHeight: 40 });
    const tall = walk({ from: AT_TOP, tops, headerHeight: 320 });
    expect(short).toEqual(tall);
    expect(tall.isShown).toBe(false);
  });

  it('hides 24px past wherever the reader turned down, deep in the page', () => {
    const from: HeaderRevealState = { isShown: true, anchor: 400 };
    expect(walk({ from, tops: [410, 423] }).isShown).toBe(true);
    expect(walk({ from, tops: [410, 424] }).isShown).toBe(false);
  });

  it('brings the header back after 8px up, summed over small steps', () => {
    const almost = walk({ from: HIDDEN, tops: [598, 596, 593] });
    expect(almost.isShown).toBe(false);
    expect(walk({ from: almost, tops: [592] }).isShown).toBe(true);
  });

  it('measures the scroll up from the lowest point the reader reached', () => {
    expect(walk({ from: HIDDEN, tops: [700, 800, 795, 792] })).toEqual({
      isShown: true,
      anchor: 792,
    });
  });

  it('does not flip on a bounce smaller than the thresholds', () => {
    expect(walk({ from: HIDDEN, tops: [900, 904, 897, 903, 899] }).isShown).toBe(false);
    const shown: HeaderRevealState = { isShown: true, anchor: 600 };
    expect(walk({ from: shown, tops: [612, 598, 620, 600] }).isShown).toBe(true);
  });

  it('shows the header at the top whatever moved the scroll', () => {
    expect(step({ state: HIDDEN, scrollTop: 0, isUserScroll: false }).isShown).toBe(true);
    expect(step({ state: HIDDEN, scrollTop: -24 }).isShown).toBe(true);
  });

  it('keeps the header while keyboard focus sits inside it', () => {
    const held = [400, 600, 900].reduce(
      (state, scrollTop) => step({ state, scrollTop, isFocusHeld: true }),
      AT_TOP,
    );
    expect(held.isShown).toBe(true);
  });

  it('never hides the header on a scroll the app made, and only moves the anchor', () => {
    const state = walk({ from: AT_TOP, tops: [520, 1400], isUserScroll: false });
    expect(state).toEqual({ isShown: true, anchor: 1400 });
    expect(step({ state, scrollTop: 1410 }).isShown).toBe(true);
  });

  it('never brings a hidden header back on a scroll the app made away from the top', () => {
    expect(walk({ from: HIDDEN, tops: [300, 200], isUserScroll: false })).toEqual({
      isShown: false,
      anchor: 200,
    });
  });

  it('never hides the header of a page too short to scroll once it is gone', () => {
    const short = step({ state: AT_TOP, scrollTop: 60, range: 180, headerHeight: 160 });
    expect(short.isShown).toBe(true);
    const enough = step({ state: AT_TOP, scrollTop: 24, range: 184, headerHeight: 160 });
    expect(enough.isShown).toBe(false);
  });

  it('keeps the header near the end, where hiding would pull the page back', () => {
    const near = step({ state: AT_TOP, scrollTop: 900, range: 1000, headerHeight: 120 });
    expect(near).toEqual({ isShown: true, anchor: 0 });
    const clear = step({ state: AT_TOP, scrollTop: 880, range: 1000, headerHeight: 120 });
    expect(clear.isShown).toBe(false);
  });

  it('keeps the header while a wheel still on its way would land near the end', () => {
    const landing = { state: AT_TOP, scrollTop: 400, range: 1000, headerHeight: 120 };
    expect(step({ ...landing, pending: 520 }).isShown).toBe(true);
    expect(step({ ...landing, pending: 480 }).isShown).toBe(false);
  });

  it('brings the header back when a hidden page no longer has room to scroll', () => {
    expect(step({ state: HIDDEN, scrollTop: 20, range: 20, isUserScroll: false }).isShown).toBe(
      true,
    );
  });
});
