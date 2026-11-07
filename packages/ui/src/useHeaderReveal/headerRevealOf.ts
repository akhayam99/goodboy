export const HIDE_THRESHOLD_PX = 24;

export const SHOW_THRESHOLD_PX = 8;

export type HeaderRevealState = {
  readonly isShown: boolean;
  readonly anchor: number;
};

type Params = {
  readonly state: HeaderRevealState;
  readonly scrollTop: number;
  readonly headerHeight: number;
  readonly isUserScroll: boolean;
  readonly isFocusHeld: boolean;
};

export const headerRevealOf = ({
  state,
  scrollTop,
  headerHeight,
  isUserScroll,
  isFocusHeld,
}: Params): HeaderRevealState => {
  const top = Math.max(0, scrollTop);
  if (top <= headerHeight || isFocusHeld) {
    return { isShown: true, anchor: top };
  }
  if (!isUserScroll) {
    return { isShown: state.isShown, anchor: top };
  }
  if (state.isShown) {
    const anchor = Math.min(state.anchor, top);
    if (top - anchor >= HIDE_THRESHOLD_PX) {
      return { isShown: false, anchor: top };
    }
    return { isShown: true, anchor };
  }
  const anchor = Math.max(state.anchor, top);
  if (anchor - top >= SHOW_THRESHOLD_PX) {
    return { isShown: true, anchor: top };
  }
  return { isShown: false, anchor };
};
