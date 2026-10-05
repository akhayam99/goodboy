import type { MountId } from '@goodboy/types';

type MountRef = {
  readonly mountId: MountId;
  readonly branch: string;
};

type Params = {
  readonly mounts: ReadonlyArray<MountRef>;
  readonly kickoff: string | null;
};

export const scribeMountOf = ({ mounts, kickoff }: Params): MountId | null => {
  if (kickoff !== null) {
    const named = mounts.find(
      (mount) => mount.branch !== '' && kickoff.includes(`pull request for ${mount.branch} into`),
    );
    if (named !== undefined) {
      return named.mountId;
    }
  }
  const [only] = mounts;
  return mounts.length === 1 && only !== undefined ? only.mountId : null;
};
