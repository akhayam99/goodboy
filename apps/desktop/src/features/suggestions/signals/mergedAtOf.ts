import type { MountId } from '@goodboy/types';
import { gitlabMountOf } from '../../../store/slices/mount-request/requestOf';
import type { MountRequestSliceState } from '../../../store/slices/mount-request/state';
import type { AppState } from '../../../store/types';

type Params = {
  readonly state: Pick<AppState, 'mountGithub'> &
    Partial<Pick<MountRequestSliceState, 'mountRequests'>>;
  readonly mountId: MountId;
  readonly provider: 'github' | 'gitlab' | 'bitbucket';
};

export const mergedAtOf = ({ state, mountId, provider }: Params): string | null => {
  switch (provider) {
    case 'github':
      return state.mountGithub[mountId]?.pr?.mergedAt ?? null;
    case 'gitlab':
      return gitlabMountOf({ state, mountId })?.mr?.mergedAt ?? null;
    case 'bitbucket':
      return null;
    default: {
      const exhaustive: never = provider;
      return exhaustive;
    }
  }
};
