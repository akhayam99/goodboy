import { ALL_HOME_WIDGETS, type HomeWidgetId } from '../grid/homeWidgets';
import type { HomeLayout } from './layoutTypes';

type Params = {
  readonly entries: HomeLayout;
};

export const trayWidgetsOf = ({ entries }: Params): ReadonlyArray<HomeWidgetId> =>
  ALL_HOME_WIDGETS.filter((id) => !entries.some((entry) => entry.id === id));
