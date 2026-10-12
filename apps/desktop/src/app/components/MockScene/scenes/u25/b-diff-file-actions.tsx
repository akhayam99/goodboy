import { DrawerScene } from './diffFileActions/DrawerScene';
import { FilterScene } from './diffFileActions/FilterScene';
import { HeaderScene } from './diffFileActions/HeaderScene';

export const U25_B_DIFF_FILE_ACTIONS_SCENES = {
  'file-actions-header': HeaderScene,
  'file-whole-drawer-unified': () => <DrawerScene isSplit={false} />,
  'file-whole-drawer-split': () => <DrawerScene isSplit />,
  'filter-files-focused': FilterScene,
};
