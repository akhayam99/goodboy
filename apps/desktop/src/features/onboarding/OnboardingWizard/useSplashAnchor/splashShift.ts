export const SPLASH_TILE_PX = 84;
export const SPLASH_TILE_CENTER_ABOVE_MIDDLE_PX = 53;

const BOTTOM_ROOM_PX = 40;

type Params = {
  readonly markCenter: number;
  readonly blockBottom: number;
  readonly viewportHeight: number;
};

export const splashShift = ({ markCenter, blockBottom, viewportHeight }: Params): number => {
  const target = viewportHeight / 2 - SPLASH_TILE_CENTER_ABOVE_MIDDLE_PX;
  const room = viewportHeight - BOTTOM_ROOM_PX - blockBottom;
  return Math.round(Math.max(0, Math.min(target - markCenter, room)));
};
