const SPLASH_MARK_PX = 64;
const SPLASH_GAP_UNDER_MARK_PX = 16;
const SPLASH_WORD_PX = 24;
const SPLASH_GAP_UNDER_WORD_PX = 2;
const SPLASH_LINE_PX = 16;
const SPLASH_GAP_UNDER_BRAND_PX = 32;
const SPLASH_PHASE_PX = 16;

const SPLASH_BLOCK_PX =
  SPLASH_MARK_PX +
  SPLASH_GAP_UNDER_MARK_PX +
  SPLASH_WORD_PX +
  SPLASH_GAP_UNDER_WORD_PX +
  SPLASH_LINE_PX +
  SPLASH_GAP_UNDER_BRAND_PX +
  SPLASH_PHASE_PX;

const SPLASH_MARK_ABOVE_MIDDLE_PX = SPLASH_BLOCK_PX / 2 - SPLASH_MARK_PX / 2;

const BOTTOM_ROOM_PX = 40;

type Params = {
  readonly markCenter: number;
  readonly blockBottom: number;
  readonly viewportHeight: number;
};

export const splashShift = ({ markCenter, blockBottom, viewportHeight }: Params): number => {
  const target = viewportHeight / 2 - SPLASH_MARK_ABOVE_MIDDLE_PX;
  const room = viewportHeight - BOTTOM_ROOM_PX - blockBottom;
  return Math.round(Math.max(0, Math.min(target - markCenter, room)));
};
