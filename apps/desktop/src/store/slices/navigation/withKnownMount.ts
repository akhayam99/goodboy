import type { SessionProjectMount } from '@goodboy/types';
import type { AppState } from '../../types';
import type { Location, SessionTarget } from './types';

type Params = {
  readonly state: AppState;
  readonly location: Location;
};

type MountTarget = Extract<SessionTarget, { readonly kind: 'diff' | 'branch' }>;

type ByIdParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly target: MountTarget;
};

const mountById = ({ mounts, target }: ByIdParams): SessionProjectMount | null => {
  const mountId = target.kind === 'branch' ? target.mountId : null;
  if (mountId == null) {
    return null;
  }
  return mounts.find((mount) => mount.mountId === mountId) ?? null;
};

export const withKnownMount = ({ state, location }: Params): Location => {
  const { place } = location;
  if (place.at !== 'session') {
    return location;
  }
  const { target } = place.view;
  if (target?.kind !== 'diff' && target?.kind !== 'branch') {
    return location;
  }
  const mounts = state.sessionProjectMounts?.[place.sessionId] ?? [];
  const known = mountById({ mounts, target });
  if (known !== null && known.worktreePath !== target.mountPath) {
    return {
      ...location,
      place: {
        ...place,
        view: { ...place.view, target: { ...target, mountPath: known.worktreePath } },
      },
    };
  }
  const { mountPath } = target;
  if (
    known !== null ||
    mountPath === null ||
    mounts.length === 0 ||
    mounts.some((mount) => mount.worktreePath === mountPath)
  ) {
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
