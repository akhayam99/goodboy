import type { AppState } from '../../types';
import type { Location } from './types';

type Params = {
  readonly state: AppState;
  readonly location: Location;
};

export const withKnownMount = ({ state, location }: Params): Location => {
  const { place } = location;
  if (place.at !== 'session') {
    return location;
  }
  const { target } = place.view;
  if ((target?.kind !== 'diff' && target?.kind !== 'branch') || target.mountPath === null) {
    return location;
  }
  const { mountPath } = target;
  const mounts = state.sessionProjectMounts?.[place.sessionId] ?? [];
  if (mounts.length === 0 || mounts.some((mount) => mount.worktreePath === mountPath)) {
    return location;
  }
  return {
    ...location,
    place: {
      ...place,
      view: { ...place.view, target: { ...target, mountPath: null, focus: null } },
    },
  };
};
