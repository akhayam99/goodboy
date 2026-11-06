import type { MountBranchObservation } from '@goodboy/types';

type Params = {
  readonly observation: MountBranchObservation;
};

export const mismatchDismissalKeyOf = ({ observation }: Params): string =>
  `${observation.mountId}:${observation.state}:${observation.recordedBranch}:${observation.observedBranch ?? ''}`;
