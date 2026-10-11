export const RIGHT_DRAWER_MIN = 384;
export const RIGHT_DRAWER_MAX = 560;
export const RIGHT_DRAWER_DEFAULT = 400;
export const READER_DRAWER_MIN = 480;
export const READER_DRAWER_MAX = 1000;
export const READER_DRAWER_DEFAULT = 720;
export const COLUMN_MIN_PUSH = 560;
export const COLUMN_GUTTERS = 48;
export const DRAWER_INSET = 8;

export type DrawerSizing = 'side' | 'reader';

export type DrawerMode = 'closed' | 'push' | 'overlay';

type TierBounds = {
  readonly min: number;
  readonly max: number;
  readonly fallback: number;
};

export const DRAWER_TIERS: Readonly<Record<DrawerSizing, TierBounds>> = {
  side: { min: RIGHT_DRAWER_MIN, max: RIGHT_DRAWER_MAX, fallback: RIGHT_DRAWER_DEFAULT },
  reader: { min: READER_DRAWER_MIN, max: READER_DRAWER_MAX, fallback: READER_DRAWER_DEFAULT },
};

export const drawerTrackOf = (drawerWidthPx: number): number => drawerWidthPx + DRAWER_INSET * 2;

type PushParams = {
  readonly mainWidthPx: number;
  readonly drawerWidthPx: number;
};

const pushRoomOf = (mainWidthPx: number): number =>
  mainWidthPx - DRAWER_INSET * 2 - COLUMN_GUTTERS - COLUMN_MIN_PUSH;

export const canDrawerPush = ({ mainWidthPx, drawerWidthPx }: PushParams): boolean =>
  pushRoomOf(mainWidthPx) >= drawerWidthPx;

export type DrawerLayout = {
  readonly mode: Exclude<DrawerMode, 'closed'>;
  readonly width: number;
  readonly dragMax: number;
};

type LayoutParams = {
  readonly main: number;
  readonly sizing: DrawerSizing;
  readonly savedWidth: number;
};

export const drawerLayoutOf = ({ main, sizing, savedWidth }: LayoutParams): DrawerLayout => {
  const tier = DRAWER_TIERS[sizing];
  const room = pushRoomOf(main);
  if (room >= savedWidth) {
    return {
      mode: 'push',
      width: savedWidth,
      dragMax: Math.min(tier.max, room),
    };
  }
  const overlayRoom = main - DRAWER_INSET * 2;
  return {
    mode: 'overlay',
    width: Math.min(savedWidth, overlayRoom),
    dragMax: Math.min(tier.max, overlayRoom),
  };
};

type AsideParams = {
  readonly width: number;
  readonly mode: DrawerMode;
};

export const drawerAsideWidthOf = ({ width, mode }: AsideParams): number => {
  if (mode === 'closed') {
    return 0;
  }
  return mode === 'overlay' ? width + DRAWER_INSET : drawerTrackOf(width);
};

type SizedParams = {
  readonly sizing: DrawerSizing;
  readonly columnWidth: number | null;
  readonly resizableWidth: number;
};

export const drawerWidthOf = ({ sizing, columnWidth, resizableWidth }: SizedParams): number => {
  if (columnWidth === null) {
    return resizableWidth;
  }
  return drawerLayoutOf({ main: columnWidth, sizing, savedWidth: resizableWidth }).width;
};

type ModeParams = {
  readonly isOpen: boolean;
  readonly sizing: DrawerSizing;
  readonly columnWidth: number | null;
  readonly drawerWidthPx: number;
};

export const drawerModeOf = ({
  isOpen,
  sizing,
  columnWidth,
  drawerWidthPx,
}: ModeParams): DrawerMode => {
  if (!isOpen) {
    return 'closed';
  }
  if (columnWidth === null) {
    return 'push';
  }
  return drawerLayoutOf({ main: columnWidth, sizing, savedWidth: drawerWidthPx }).mode;
};

type MainParams = {
  readonly columnWidth: number;
  readonly mode: DrawerMode;
  readonly drawerWidthPx: number;
};

export const mainWidthOf = ({ columnWidth, mode, drawerWidthPx }: MainParams): number =>
  mode === 'push' ? columnWidth - drawerTrackOf(drawerWidthPx) : columnWidth;

export const COLUMN_FRAME = 1008;
export const MEASURE_FRAME = 768;

export type PageTier = 'column' | 'measure' | 'full';

type PageBoxParams = {
  readonly paneWidth: number;
  readonly tier: PageTier;
  readonly drawerWidthPx: number | null;
  readonly sizing?: DrawerSizing;
};

export type PageBox = {
  readonly left: number;
  readonly right: number;
  readonly width: number;
};

type PushedSpaceParams = {
  readonly paneWidth: number;
  readonly sizing: DrawerSizing;
  readonly savedWidth: number;
};

const pushedSpaceOf = ({ paneWidth, sizing, savedWidth }: PushedSpaceParams): number => {
  const layout = drawerLayoutOf({ main: paneWidth, sizing, savedWidth });
  return mainWidthOf({ columnWidth: paneWidth, mode: layout.mode, drawerWidthPx: layout.width });
};

export const pageBoxOf = ({
  paneWidth,
  tier,
  drawerWidthPx,
  sizing = 'side',
}: PageBoxParams): PageBox => {
  const space =
    drawerWidthPx === null
      ? paneWidth
      : pushedSpaceOf({ paneWidth, sizing, savedWidth: drawerWidthPx });
  if (tier === 'full') {
    return { left: 0, right: space, width: space };
  }
  const width = Math.min(tier === 'column' ? COLUMN_FRAME : MEASURE_FRAME, space);
  const left = (space - width) / 2;
  return { left, right: left + width, width };
};
