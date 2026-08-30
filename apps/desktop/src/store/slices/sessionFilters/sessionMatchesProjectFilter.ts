import type { SessionProjectMount } from '@goodboy/types';
import { NO_PROJECT_FILTER_ID } from './types';

type Params = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly selectedProjectIds: ReadonlyArray<string>;
};

export const sessionMatchesProjectFilter = ({ mounts, selectedProjectIds }: Params): boolean => {
  if (selectedProjectIds.length === 0) {
    return true;
  }
  if (mounts.length === 0) {
    return selectedProjectIds.includes(NO_PROJECT_FILTER_ID);
  }
  return mounts.some((mount) => selectedProjectIds.includes(mount.projectId));
};
