import { SHELL_GUTTER_PX } from './frameGeometry';
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
export const DRAWER_GUTTER = SHELL_GUTTER_PX;
export const DRAWER_EXIT_MS = DURATION_QUICK_MS;
export const DRAWER_EXIT_MAX_ELEMENTS = 2000;

export type DrawerSizing = 'side' | 'reader' | 'browser';

export type DrawerMode = 'closed' | 'push' | 'overlay';

export type DrawerPlacement = 'auto' | 'overlay';

type TierBounds = {
  readonly min: number;
  readonly max: number;
  readonly fallback: number;
};

export const DRAWER_TIERS: Readonly<Record<DrawerSizing, TierBounds>> = {
  side: { min: RIGHT_DRAWER_MIN, max: RIGHT_DRAWER_MAX, fallback: RIGHT_DRAWER_DEFAULT },
  reader: { min: READER_DRAWER_MIN, max: READER_DRAWER_MAX, fallback: READER_DRAWER_DEFAULT },
  browser: { min: READER_DRAWER_MIN, max: BROWSER_DRAWER_MAX, fallback: READER_DRAWER_DEFAULT },
};

type PushParams = {
  readonly mainWidthPx: number;
  readonly drawerWidthPx: number;
  readonly sizing?: DrawerSizing;
};

export const DRAWER_PUSH_RESERVE = DRAWER_INSET * 2 + COLUMN_GUTTERS + COLUMN_MIN_PUSH;

type ReserveParams = {
  readonly sizing: DrawerSizing;
};

export const pushReserveOf = ({ sizing }: ReserveParams): number =>
  DRAWER_INSET * 2 +
  COLUMN_GUTTERS +
  (sizing === 'side' ? COLUMN_MIN_PUSH : READER_COLUMN_MIN_PUSH);

type RoomParams = {
  readonly mainWidthPx: number;
  readonly sizing: DrawerSizing;
};

const pushRoomOf = ({ mainWidthPx, sizing }: RoomParams): number =>
  mainWidthPx - pushReserveOf({ sizing });

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
  const pushWidth = room >= tier.min ? Math.min(savedWidth, room) : savedWidth;
  if (placement === 'auto' && room >= pushWidth) {
    return {
      mode: 'push',
      width: pushWidth,
      dragMax: Math.min(tier.max, room),
    };
  }
  const overlayRoom = main - DRAWER_GUTTER * 2 - edgeWidth;
  return {
    mode: 'overlay',
    width: Math.min(savedWidth, overlayRoom),
    dragMax: Math.min(tier.max, overlayRoom),
  };
};

type PanelWidth = Pick<DrawerLayout, 'width' | 'dragMax'>;

export type PanelPairLayout = {
  readonly mode: DrawerLayout['mode'];
  readonly isDetailOver: boolean;
  readonly dock: PanelWidth;
  readonly detail: PanelWidth;
};

type PairAsideParams = {
  readonly dockWidth: number;
  readonly detailWidth: number;
  readonly railWidth?: number;
};

export const panelAsideWidthOf = ({
  dockWidth,
  detailWidth,
  railWidth = 0,
}: PairAsideParams): number => {
  const container = dockWidth + railWidth;
  return (
    (detailWidth > 0 ? detailWidth + DRAWER_GUTTER : 0) +
    (container > 0 ? container + DRAWER_GUTTER : 0)
  );
};

type AsideParams = {
  readonly width: number;
  readonly mode: DrawerMode;
  readonly railWidth?: number;
};

export const drawerAsideWidthOf = ({ width, mode, railWidth = 0 }: AsideParams): number =>
  panelAsideWidthOf({ dockWidth: mode === 'closed' ? 0 : width, detailWidth: 0, railWidth });

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
  readonly railWidth?: number;
};

export const mainWidthOf = ({
  columnWidth,
  mode,
  drawerWidthPx,
  railWidth = 0,
}: MainParams): number =>
  columnWidth -
  drawerAsideWidthOf({
    width: drawerWidthPx,
    mode: mode === 'push' ? 'push' : 'closed',
    railWidth,
  });

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
