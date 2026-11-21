import type { MountId } from '@goodboy/types';
import type { AppState } from '../../../../../store/types';

type Params = {
  readonly state: Pick<AppState, 'mountGithub'>;
  readonly mountIds: ReadonlyArray<MountId>;
};

export const readFailedOf = ({ state, mountIds }: Params): boolean =>
  mountIds.some((mountId) => {
    const entry = state.mountGithub?.[mountId];
    if (entry === undefined || entry.failedAt === null) {
      return false;
    }
    return entry.fetchedAt === null || entry.failedAt > entry.fetchedAt;
  });
