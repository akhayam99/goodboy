import type { MountId, SessionProjectMount } from '@goodboy/types';
import type { BranchPushState } from '../../../shared/lib/branchPushState';
import { cleanupRequestId } from '../../../store/slices/mount-cleanup/cleanupProposals';
import type { SignalIdleMount } from '../nextStepSignals';

const IDLE_REASON = 'unmount' as const;

type IdleFact = {
  readonly mountId: MountId;
  readonly isRepo: boolean;
  readonly isClean: boolean | null;
  readonly push: BranchPushState | null;
  readonly hasOpenPr: boolean;
};

type MountParams = {
  readonly mount: SessionProjectMount;
};

type Params = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly facts: ReadonlyArray<IdleFact>;
  readonly touches: Readonly<Record<string, number>>;
  readonly proposedMountIds: ReadonlySet<string>;
  readonly projectNameOf: (params: MountParams) => string;
};

type PushParams = {
  readonly push: BranchPushState | null;
};

const hasUnpushedWorkOf = ({ push }: PushParams): boolean => {
  if (push === null) {
    return true;
  }
  switch (push.kind) {
    case 'in-sync':
    case 'behind':
    case 'gone':
      return false;
    case 'not-pushed':
      return push.commits === null || push.commits > 0;
    case 'ahead':
    case 'diverged':
    case 'unknown':
      return true;
    default: {
      const exhaustive: never = push;
      return exhaustive;
    }
  }
};

export const idleMountsOf = ({
  mounts,
  facts,
  touches,
  proposedMountIds,
  projectNameOf,
}: Params): ReadonlyArray<SignalIdleMount> =>
  facts.flatMap((fact): ReadonlyArray<SignalIdleMount> => {
    const mount = mounts.find((candidate) => candidate.mountId === fact.mountId);
    if (mount === undefined) {
      return [];
    }
    return [
      {
        mountId: mount.mountId,
        projectId: mount.projectId,
        projectName: projectNameOf({ mount }),
        branch: mount.branch,
        isRepo: fact.isRepo,
        isClean: fact.isClean === true,
        hasUnpushedWork: hasUnpushedWorkOf({ push: fact.push }),
        hasOpenPr: fact.hasOpenPr,
        lastTouchedMs: touches[mount.mountId] ?? null,
        requestId: cleanupRequestId({
          mountId: mount.mountId,
          branch: mount.branch,
          reason: IDLE_REASON,
        }),
        isProposed: proposedMountIds.has(mount.mountId),
      },
    ];
  });
