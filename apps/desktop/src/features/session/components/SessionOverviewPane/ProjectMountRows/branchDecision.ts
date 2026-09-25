import type { MountBranchObservation, MountBranchResolution } from '@goodboy/types';
import type { MountBranchHolder } from '../../../../../store/slices/project-mounts/mountRowModel';

type Params = {
  readonly observation: MountBranchObservation;
  readonly projectName: string;
  readonly holder: MountBranchHolder | 'checking' | null;
};

export type BranchDecisionAction = Readonly<{
  label: string;
  resolution: MountBranchResolution;
  isDisabled: boolean;
}>;

export type BranchDecision = Readonly<{
  title: string;
  description: string;
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
    return 'in another worktree of this project';
  }
  if (holder.label === null) {
    return 'in another worktree of this session';
  }
  return `as ${holder.label} in this session`;
};

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
        title: `${projectName}'s branch could not be read`,
        description: `Expected ${recorded}, but its directory could not be read.`,
        confirm: recheck({ isDisabled: false }),
        alt: null,
      };
    case 'detached': {
      const title = `${projectName} is not on a branch`;
      const cause = `Expected ${recorded}, found a commit with no branch.`;
      if (holder !== null && holder !== 'checking') {
        return {
          title,
          description: `${cause} ${recorded} is already checked out ${holderLocation({ holder })}.`,
          confirm: recheck({ isDisabled: false }),
          alt: null,
        };
      }
      return {
        title,
        description: cause,
        confirm: {
          label: `Put it back on ${recorded}`,
          resolution: 'restore-recorded',
          isDisabled: holder === 'checking',
        },
        alt: recheck({ isDisabled: false }),
      };
    }
    case 'mismatch': {
      const found = observed ?? 'another branch';
      const title = `${projectName} is not on the branch it was left on`;
      const cause = `Expected ${recorded}, found ${found}.`;
      if (holder === 'checking') {
        return {
          title,
          description: cause,
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
          description: `${cause} ${found} is already checked out ${holderLocation({ holder })}, and git keeps one branch in one worktree.`,
          confirm: recheck({ isDisabled: false }),
          alt: null,
        };
      }
      return {
        title,
        description: `${cause} Keep both branches keeps ${found} here and opens ${recorded} again in a worktree of its own.`,
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
