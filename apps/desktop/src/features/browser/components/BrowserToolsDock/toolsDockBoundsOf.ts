import type { BrowserToolsSide } from '../../browserToolsDockPref';

type Room = {
  readonly width: number;
  readonly height: number;
};

type Params = {
  readonly side: BrowserToolsSide;
  readonly room: Room | null;
};

type Bounds = {
  readonly min: number;
  readonly max: number;
};

const LIMITS = {
  bottom: { min: 110, pageRoom: 140, cap: 640 },
  right: { min: 260, pageRoom: 280, cap: 960 },
} as const satisfies Record<BrowserToolsSide, Readonly<Record<string, number>>>;

export const toolsDockBoundsOf = ({ side, room }: Params): Bounds => {
  const limits = LIMITS[side];
  if (room === null) {
    return { min: limits.min, max: limits.cap };
  }
  const length = side === 'right' ? room.width : room.height;
  if (length <= 0) {
    return { min: limits.min, max: limits.cap };
  }
  return { min: limits.min, max: Math.max(limits.min, length - limits.pageRoom) };
};
