import { DURATION_QUICK_MS } from './motionTimings';

export const RIGHT_DRAWER_MIN = 384;
export const RIGHT_DRAWER_MAX = 560;
export const RIGHT_DRAWER_DEFAULT = 400;
export const READER_DRAWER_MIN = 480;
export const READER_DRAWER_MAX = 1000;
export const READER_DRAWER_DEFAULT = 720;
export const BROWSER_DRAWER_MAX = 5120;
export const COLUMN_MIN_PUSH = 464;
const READER_COLUMN_MIN_PUSH = 560;
export const COLUMN_GUTTERS = 48;
export const DRAWER_INSET = 8;
export const DRAWER_EXIT_MS = DURATION_QUICK_MS;
export const DRAWER_EXIT_MAX_ELEMENTS = 2000;

export type DrawerSizing = 'side' | 'reader' | 'browser';

export type DrawerMode = 'closed' | 'push' | 'overlay';

export type DrawerPlacement = 'auto' | 'overlay';

type TierBounds = {
  readonly min: number;
  readonly max: number;
  readonly fallback: number;
  readonly isShrinkable?: boolean;
};

export const DRAWER_TIERS: Readonly<Record<DrawerSizing, TierBounds>> = {
  side: { min: RIGHT_DRAWER_MIN, max: RIGHT_DRAWER_MAX, fallback: RIGHT_DRAWER_DEFAULT },
  reader: { min: READER_DRAWER_MIN, max: READER_DRAWER_MAX, fallback: READER_DRAWER_DEFAULT },
  browser: {
    min: READER_DRAWER_MIN,
    max: BROWSER_DRAWER_MAX,
    fallback: READER_DRAWER_DEFAULT,
    isShrinkable: true,
  },
};

export const drawerTrackOf = (drawerWidthPx: number): number => drawerWidthPx + DRAWER_INSET * 2;

type PushParams = {
  readonly mainWidthPx: number;
  readonly drawerWidthPx: number;
  readonly sizing?: DrawerSizing;
};

export const DRAWER_PUSH_RESERVE = DRAWER_INSET * 2 + COLUMN_GUTTERS + COLUMN_MIN_PUSH;

type RoomParams = {
  readonly mainWidthPx: number;
  readonly sizing: DrawerSizing;
};

const pushRoomOf = ({ mainWidthPx, sizing }: RoomParams): number =>
  mainWidthPx -
  DRAWER_INSET * 2 -
  COLUMN_GUTTERS -
  (sizing === 'side' ? COLUMN_MIN_PUSH : READER_COLUMN_MIN_PUSH);

export const canDrawerPush = ({
  mainWidthPx,
  drawerWidthPx,
  sizing = 'side',
}: PushParams): boolean => pushRoomOf({ mainWidthPx, sizing }) >= drawerWidthPx;

export type DrawerLayout = {
  readonly mode: Exclude<DrawerMode, 'closed'>;
  readonly width: number;
  readonly dragMax: number;
};

type LayoutParams = {
  readonly main: number;
  readonly sizing: DrawerSizing;
  readonly savedWidth: number;
  readonly placement?: DrawerPlacement;
  readonly edgeWidth?: number;
  readonly contentInset?: number;
};

export const drawerLayoutOf = ({
  main,
  sizing,
  savedWidth,
  placement = 'auto',
  edgeWidth = 0,
  contentInset = 0,
}: LayoutParams): DrawerLayout => {
  const tier = DRAWER_TIERS[sizing];
  const room = pushRoomOf({ mainWidthPx: main - contentInset, sizing });
  const pushWidth =
    tier.isShrinkable === true && room >= tier.fallback ? Math.min(savedWidth, room) : savedWidth;
  if (placement === 'auto' && room >= pushWidth) {
    return {
      mode: 'push',
      width: pushWidth,
      dragMax: Math.min(tier.max, room),
    };
  }
  const overlayRoom = main - DRAWER_INSET * 2 - edgeWidth;
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

type FoldParams = {
  readonly mainWidthPx: number;
  readonly drawerWidthPx?: number;
  readonly sizing: DrawerSizing;
};

export const isRailFoldNeeded = ({
  mainWidthPx,
  drawerWidthPx = RIGHT_DRAWER_DEFAULT,
  sizing,
}: FoldParams): boolean => !canDrawerPush({ mainWidthPx, drawerWidthPx, sizing });
