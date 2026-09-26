const MIN_THUMB_LENGTH = 24;
export const TRACK_INSET = 8;

export type ThumbGeometryParams = {
  readonly scrollSize: number;
  readonly clientSize: number;
  readonly scrollPos: number;
};

export type ThumbGeometry = {
  readonly hasOverflow: boolean;
  readonly length: number;
  readonly offset: number;
};

export const thumbGeometry = ({
  scrollSize,
  clientSize,
  scrollPos,
}: ThumbGeometryParams): ThumbGeometry => {
  const hasOverflow = scrollSize > clientSize + 1;
  if (!hasOverflow) {
    return { hasOverflow, length: 0, offset: 0 };
  }
  const trackLength = clientSize - TRACK_INSET;
  const length = Math.max(MIN_THUMB_LENGTH, (clientSize / scrollSize) * trackLength);
  const maxScroll = scrollSize - clientSize;
  const offset = maxScroll <= 0 ? 0 : (scrollPos / maxScroll) * (trackLength - length);
  return { hasOverflow, length, offset };
};
