import { AUTO_SCROLL_MAX_PX, AUTO_SCROLL_ZONE_PX } from './reorderTypes';

type Params = {
  readonly pointerY: number;
  readonly top: number;
  readonly bottom: number;
};

type RampParams = {
  readonly depth: number;
};

const rampOf = ({ depth }: RampParams): number => {
  const ratio = Math.min(Math.max(depth / AUTO_SCROLL_ZONE_PX, 0), 1);
  return ratio * ratio * AUTO_SCROLL_MAX_PX;
};

export const autoScrollSpeedOf = ({ pointerY, top, bottom }: Params): number => {
  const above = rampOf({ depth: top + AUTO_SCROLL_ZONE_PX - pointerY });
  if (above > 0) {
    return -above;
  }
  return rampOf({ depth: pointerY - (bottom - AUTO_SCROLL_ZONE_PX) });
};
