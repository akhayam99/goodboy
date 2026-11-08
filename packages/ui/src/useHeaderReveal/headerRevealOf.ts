import type { HeaderRevealState } from './headerRevealState';

const HIDE_AFTER_PX = 24;
const SHOW_AFTER_PX = 8;
const AT_TOP_PX = 1;

type Params = {
  readonly state: HeaderRevealState;
  readonly scrollTop: number;
  readonly range: number;
  readonly headerHeight: number;
  readonly pending: number;
  readonly isUserScroll: boolean;
  readonly isFocusHeld: boolean;
};

export const headerRevealOf = ({
  state,
  scrollTop,
  range,
  headerHeight,
  pending,
  isUserScroll,
  isFocusHeld,
}: Params): HeaderRevealState => {
  const top = Math.max(0, scrollTop);
  const roomWhenHidden = state.isShown ? range - headerHeight : range;
  if (top <= AT_TOP_PX || isFocusHeld || roomWhenHidden < HIDE_AFTER_PX) {
    return { isShown: true, anchor: top };
  }
  if (!isUserScroll) {
    return { isShown: state.isShown, anchor: top };
  }
  if (state.isShown) {
    const anchor = Math.min(state.anchor, top);
    const landing = Math.min(range, top + pending);
    if (top - anchor >= HIDE_AFTER_PX && range - landing >= headerHeight) {
      return { isShown: false, anchor: top };
    }
    return { isShown: true, anchor };
  }
  const anchor = Math.max(state.anchor, top);
  if (anchor - top >= SHOW_AFTER_PX) {
    return { isShown: true, anchor: top };
  }
  return { isShown: false, anchor };
};
