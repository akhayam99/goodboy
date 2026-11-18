import type { SessionViewPrefs } from '@goodboy/types';
import { DEFAULT_PREFS } from '../../../../../store/slices/session-view/types';

type Params = {
  readonly prefs: SessionViewPrefs;
  readonly selectedProjectIds: ReadonlyArray<string>;
};

export type DisplayState = {
  readonly activeFilterCount: number;
  readonly isDefault: boolean;
};

export const displayStateOf = ({ prefs, selectedProjectIds }: Params): DisplayState => {
  const activeFilterCount = selectedProjectIds.length;
  const isDisplayDefault = prefs.sort === DEFAULT_PREFS.sort;
  return { activeFilterCount, isDefault: activeFilterCount === 0 && isDisplayDefault };
};
