import type { MountId, SessionProjectMount } from '@goodboy/types';
import { cleanupRequestId } from '../../../store/slices/mount-cleanup/cleanupProposals';
import type { SignalMergedMount } from '../nextStepSignals';

type MergedFact = {
  readonly mountId: MountId;
  readonly prNumber: number | null;
  readonly mergedAt: string | null;
};

type MountParams = {
  readonly mount: SessionProjectMount;
};

type Params = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly merged: ReadonlyArray<MergedFact>;
  readonly proposedMountIds: ReadonlySet<string>;
  readonly projectNameOf: (params: MountParams) => string;
};

export const mergedMountsOf = ({
  mounts,
  merged,
  proposedMountIds,
  projectNameOf,
}: Params): ReadonlyArray<SignalMergedMount> =>
  merged.flatMap((fact): ReadonlyArray<SignalMergedMount> => {
    const mount = mounts.find((candidate) => candidate.mountId === fact.mountId);
    if (mount === undefined || mount.diskState !== 'present' || fact.prNumber === null) {
      return [];
    }
    return [
      {
        mountId: mount.mountId,
        projectName: projectNameOf({ mount }),
        branch: mount.branch,
        prNumber: fact.prNumber,
        mergedAt: fact.mergedAt,
        requestId: cleanupRequestId({
          mountId: mount.mountId,
          branch: mount.branch,
          reason: 'merge_cleanup',
        }),
        isProposed: proposedMountIds.has(mount.mountId),
      },
    ];
  });
