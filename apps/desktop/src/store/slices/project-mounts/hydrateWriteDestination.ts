import type { MountId, ProjectId, SessionProjectMount } from '@goodboy/types';
import { findMountById } from './findMountById';
import { recoverSoleMount } from './recoverSoleMount';

export type WriteDestinationHydration =
  | Readonly<{
      kind: 'restored';
      mountId: MountId;
      projectId: ProjectId;
      branch: string;
    }>
  | Readonly<{
      kind: 'repaired';
      mountId: MountId;
      projectId: ProjectId;
      branch: string;
    }>
  | Readonly<{ kind: 'unselected' }>
  | Readonly<{ kind: 'scratch' }>;

type Params = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly storedMountId: MountId | null | undefined;
};

export const hydrateWriteDestination = ({
  mounts,
  storedMountId,
}: Params): WriteDestinationHydration => {
  const stored = findMountById({ mounts, mountId: storedMountId });
  if (stored !== null) {
    return {
      kind: 'restored',
      mountId: stored.mountId,
      projectId: stored.projectId,
      branch: stored.branch,
    };
  }
  if (mounts.length === 0) {
    return { kind: 'scratch' };
  }
  const sole = recoverSoleMount({ mounts });
  if (sole === null) {
    return { kind: 'unselected' };
  }
  return {
    kind: 'repaired',
    mountId: sole.mountId,
    projectId: sole.projectId,
    branch: sole.branch,
  };
};
