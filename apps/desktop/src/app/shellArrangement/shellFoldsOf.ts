import { COLLAPSED_RAIL_WIDTH } from '@goodboy/ui';

const SESSION_PAGE_MIN = 720;

const MAIN_HANDLE_WIDTH = 6;

type Params = {
  readonly windowWidth: number | null;
  readonly mainWidth: number;
  readonly railWidth: number;
  readonly paneWidth: number;
};

export type ShellFolds = {
  readonly isMainNarrow: boolean;
  readonly isRailNarrow: boolean;
};

const NONE: ShellFolds = { isMainNarrow: false, isRailNarrow: false };

export const shellFoldsOf = ({
  windowWidth,
  mainWidth,
  railWidth,
  paneWidth,
}: Params): ShellFolds => {
  if (windowWidth === null || windowWidth <= 0) {
    return NONE;
  }
  const room = windowWidth - paneWidth;
  const isMainNarrow = room - mainWidth - MAIN_HANDLE_WIDTH - railWidth < SESSION_PAGE_MIN;
  const isRailNarrow = room - COLLAPSED_RAIL_WIDTH - railWidth < SESSION_PAGE_MIN;
  return { isMainNarrow, isRailNarrow };
};
