import type { SessionViewPrefs } from '@goodboy/types';
import { DEFAULT_PREFS } from '../../../../../store/slices/session-view/types';

type Params = {
  readonly prefs: SessionViewPrefs;
  readonly selectedProjectIds: ReadonlyArray<string>;
  readonly isBoard: boolean;
};

export type DisplayState = {
  readonly activeFilterCount: number;
  readonly isDefault: boolean;
};

export const displayStateOf = ({ prefs, selectedProjectIds, isBoard }: Params): DisplayState => {
  const statusCount = isBoard ? 0 : prefs.statusFilter.length;
  const activeFilterCount =
    statusCount + selectedProjectIds.length + (!isBoard && prefs.isArchivedShown ? 1 : 0);
  const isDisplayDefault =
    prefs.sort === DEFAULT_PREFS.sort && (isBoard || prefs.group === DEFAULT_PREFS.group);
  return { activeFilterCount, isDefault: activeFilterCount === 0 && isDisplayDefault };
};
