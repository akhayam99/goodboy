import type { MountBranchObservation, MountBranchResolution } from '@goodboy/types';
import type { MountBranchHolder } from '../../../../../store/slices/project-mounts/mountRowModel';

type Params = {
  readonly observation: MountBranchObservation;
  readonly projectName: string;
  readonly holder: MountBranchHolder | 'checking' | null;
};

type BranchDecisionAction = Readonly<{
  label: string;
  resolution: MountBranchResolution;
  isDisabled: boolean;
}>;

export type BranchFound = Readonly<{
  text: string;
  isBranch: boolean;
}>;

export type BranchDecision = Readonly<{
  title: string;
  expected: string;
  found: BranchFound | null;
  note: string | null;
  confirm: BranchDecisionAction;
  alt: BranchDecisionAction | null;
}>;

type RecheckParams = {
  readonly isDisabled: boolean;
};

const recheck = ({ isDisabled }: RecheckParams): BranchDecisionAction => ({
  label: 'Check again',
  resolution: 'recheck',
  isDisabled,
});

type LocationParams = {
  readonly holder: MountBranchHolder;
};

const holderLocation = ({ holder }: LocationParams): string => {
  if (holder.mountId === null) {
    return 'in another worktree of this folder';
  }
  if (holder.label === null) {
    return 'in another worktree of this session';
  }
  return `as ${holder.label} in this session`;
};

const NO_BRANCH: BranchFound = { text: 'a commit with no branch', isBranch: false };

export const buildBranchDecision = ({
  observation,
  projectName,
  holder,
}: Params): BranchDecision | null => {
  const recorded = observation.recordedBranch;
  const observed = observation.observedBranch;
  switch (observation.state) {
    case 'matched':
      return null;
    case 'unavailable':
      return {
        title: `${projectName}'s branch couldn't be read`,
        expected: recorded,
        found: null,
        note: "Its directory couldn't be read.",
        confirm: recheck({ isDisabled: false }),
        alt: null,
      };
    case 'detached': {
      const title = `${projectName} is not on a branch`;
      if (holder !== null && holder !== 'checking') {
        return {
          title,
          expected: recorded,
          found: NO_BRANCH,
          note: `${recorded} is already checked out ${holderLocation({ holder })}.`,
          confirm: recheck({ isDisabled: false }),
          alt: null,
        };
      }
      return {
        title,
        expected: recorded,
        found: NO_BRANCH,
        note: null,
        confirm: {
          label: `Put it back on ${recorded}`,
          resolution: 'restore-recorded',
          isDisabled: holder === 'checking',
        },
        alt: recheck({ isDisabled: false }),
      };
    }
    case 'mismatch': {
      const found: BranchFound =
        observed === null
          ? { text: 'another branch', isBranch: false }
          : { text: observed, isBranch: true };
      const title = `${projectName} is on another branch`;
      if (holder === 'checking') {
        return {
          title,
          expected: recorded,
          found,
          note: null,
          confirm: {
            label: 'Use this branch here',
            resolution: 'adopt-observed',
            isDisabled: true,
          },
          alt: recheck({ isDisabled: false }),
        };
      }
      if (holder !== null) {
        return {
          title,
          expected: recorded,
          found,
          note: `${found.text} is already checked out ${holderLocation({ holder })}.`,
          confirm: recheck({ isDisabled: false }),
          alt: null,
        };
      }
      return {
        title,
        expected: recorded,
        found,
        note: null,
        confirm: { label: 'Use this branch here', resolution: 'adopt-observed', isDisabled: false },
        alt: { label: 'Keep both branches', resolution: 'keep-both', isDisabled: false },
      };
    }
    default: {
      const exhaustive: never = observation.state;
      return exhaustive;
    }
  }
};
