import type { AppState } from '../../types';
import type { Place, SessionTarget } from './types';

type Params = {
  readonly state: AppState;
  readonly place: Place;
};

type MountTarget = Extract<SessionTarget, { readonly kind: 'diff' | 'branch' }>;

type KnownParams = {
  readonly state: AppState;
  readonly place: Extract<Place, { readonly at: 'session' }>;
  readonly target: MountTarget;
};

const knownTarget = ({ state, place, target }: KnownParams): MountTarget => {
  const mounts = state.sessionProjectMounts?.[place.sessionId] ?? [];
  if (mounts.length === 0) {
    return target;
  }
  if (target.kind === 'branch' && target.mountId !== null) {
    const { mountId } = target;
    const known = mounts.find((mount) => mount.mountId === mountId) ?? null;
    if (known === null) {
      return { ...target, mountId: null, mountPath: null, focus: null };
    }
    return known.worktreePath === target.mountPath
      ? target
      : { ...target, mountPath: known.worktreePath };
  }
  const { mountPath } = target;
  if (mountPath === null) {
    return target;
  }
  const atPath = mounts.find((mount) => mount.worktreePath === mountPath) ?? null;
  if (atPath === null) {
    return { ...target, mountPath: null, focus: null };
  }
  return target.kind === 'branch' ? { ...target, mountId: atPath.mountId } : target;
};

export const withKnownMount = ({ state, place }: Params): Place => {
  if (place.at !== 'session') {
    return place;
  }
  const { target } = place.view;
  if (target?.kind !== 'diff' && target?.kind !== 'branch') {
    return place;
  }
  const known = knownTarget({ state, place, target });
  return known === target ? place : { ...place, view: { ...place.view, target: known } };
};
