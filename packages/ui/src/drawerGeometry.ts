export const RIGHT_DRAWER_MIN = 340;
export const RIGHT_DRAWER_MAX = 560;
export const RIGHT_DRAWER_DEFAULT = 400;
export const COLUMN_MIN_PUSH = 560;
export const COLUMN_GUTTERS = 48;
export const DRAWER_INSET = 8;

export type DrawerSizing = 'default' | 'half' | 'full';

export type DrawerMode = 'closed' | 'push' | 'overlay';

export const drawerTrackOf = (drawerWidthPx: number): number => drawerWidthPx + DRAWER_INSET * 2;

type PushParams = {
  readonly mainWidthPx: number;
  readonly drawerWidthPx: number;
};

export const canDrawerPush = ({ mainWidthPx, drawerWidthPx }: PushParams): boolean =>
  mainWidthPx - drawerTrackOf(drawerWidthPx) - COLUMN_GUTTERS >= COLUMN_MIN_PUSH;

type SizedParams = {
  readonly sizing: DrawerSizing;
  readonly columnWidth: number | null;
  readonly resizableWidth: number;
};

const pushableWidthOf = (columnWidth: number): number =>
  columnWidth - COLUMN_GUTTERS - COLUMN_MIN_PUSH - DRAWER_INSET * 2;

export const drawerWidthOf = ({ sizing, columnWidth, resizableWidth }: SizedParams): number => {
  if (sizing === 'default' || columnWidth === null) {
    return resizableWidth;
  }
  if (sizing === 'full') {
    return Math.max(RIGHT_DRAWER_MIN, columnWidth - DRAWER_INSET * 2);
  }
  const half = Math.round(columnWidth / 2) - DRAWER_INSET * 2;
  const pushable = pushableWidthOf(columnWidth);
  return Math.max(RIGHT_DRAWER_MIN, pushable >= RIGHT_DRAWER_MIN ? Math.min(half, pushable) : half);
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
  if (sizing === 'full' || !canDrawerPush({ mainWidthPx: columnWidth, drawerWidthPx })) {
    return 'overlay';
  }
  return 'push';
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

export const pageBoxOf = ({
  paneWidth,
  tier,
  drawerWidthPx,
  sizing = 'default',
}: PageBoxParams): PageBox => {
  const mode =
    drawerWidthPx === null
      ? 'closed'
      : drawerModeOf({ isOpen: true, sizing, columnWidth: paneWidth, drawerWidthPx });
  const space = mainWidthOf({ columnWidth: paneWidth, mode, drawerWidthPx: drawerWidthPx ?? 0 });
  if (tier === 'full') {
    return { left: 0, right: space, width: space };
  }
  const width = Math.min(tier === 'column' ? COLUMN_FRAME : MEASURE_FRAME, space);
  const left = (space - width) / 2;
  return { left, right: left + width, width };
};
