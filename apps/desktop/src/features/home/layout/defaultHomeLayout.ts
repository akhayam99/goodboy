import { DEFAULT_HOME_LAYOUT, HOME_WIDGETS } from '../grid/homeWidgets';
import type { HomeLayout } from './layoutTypes';

export const DEFAULT_HOME_ENTRIES: HomeLayout = DEFAULT_HOME_LAYOUT.map((id) => ({
  id,
  size: HOME_WIDGETS[id].defaultSize,
}));
