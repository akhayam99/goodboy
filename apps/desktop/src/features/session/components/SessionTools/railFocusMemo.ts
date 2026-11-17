import type { RailToolId } from './sessionTools';

type RailFocus = {
  pane: RailToolId | null;
  hasFocus: boolean;
  isDrawerOpener: boolean;
};

export const railFocusMemo: RailFocus = { pane: null, hasFocus: false, isDrawerOpener: false };
