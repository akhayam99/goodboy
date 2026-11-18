type Params = {
  readonly scroller: HTMLElement;
  readonly minimumPx: number;
};

export const anchorTopOf = ({ scroller, minimumPx }: Params): number => {
  const padding = Number.parseFloat(getComputedStyle(scroller).paddingTop);
  return Number.isFinite(padding) ? Math.max(minimumPx, padding) : minimumPx;
};
