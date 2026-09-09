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
  notes: ReadonlyArray<string>;
  confirm: BranchDecisionAction;
  alt: BranchDecisionAction | null;
}>;

const RECHECK_NOTE = 'Check this mount again reads its directory and updates this note.';
const NOT_NOW_NOTE = 'Not now hides this note for now and changes nothing.';

type RecheckParams = {
  readonly isDisabled: boolean;
};

const recheck = ({ isDisabled }: RecheckParams): BranchDecisionAction => ({
  label: 'Check this mount again',
  resolution: 'recheck',
  isDisabled,
});

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
        description: `Expected ${recorded}, but the directory could not be read. Nothing was changed.`,
        notes: [RECHECK_NOTE, NOT_NOW_NOTE],
        confirm: recheck({ isDisabled: false }),
        alt: null,
      };
    case 'detached': {
      const isChecking = holder === 'checking';
      const isHeld = holder !== null && holder !== 'checking';
      return {
        title: `${projectName} is not on a branch`,
        description: `Expected ${recorded}, found a commit with no branch. Nothing was changed.`,
        notes: [
          ...(isChecking
            ? [
                `Goodboy is checking whether ${recorded} is mounted in another worktree.`,
                `Put it back on ${recorded} stays off until this check finishes.`,
              ]
            : []),
          ...(isHeld
            ? [
                `${recorded} is already mounted in another worktree, so putting it back here is turned off.`,
              ]
            : isChecking
              ? []
              : [`Put it back on ${recorded} moves this mount onto ${recorded} again.`]),
          RECHECK_NOTE,
          NOT_NOW_NOTE,
        ],
        confirm: {
          label: `Put it back on ${recorded}`,
          resolution: 'restore-recorded',
          isDisabled: isChecking || isHeld,
        },
        alt: recheck({ isDisabled: false }),
      };
    }
    case 'mismatch': {
      const found = observed ?? 'another branch';
      if (holder === 'checking') {
        return {
          title: `${projectName} is not on the branch it was left on`,
          description: `Expected ${recorded}, found ${found}. Nothing was changed.`,
          notes: [
            `Goodboy is checking whether ${found} is mounted in another worktree.`,
            RECHECK_NOTE,
            NOT_NOW_NOTE,
          ],
          confirm: {
            label: 'Use this branch here',
            resolution: 'adopt-observed',
            isDisabled: true,
          },
          alt: recheck({ isDisabled: false }),
        };
      }
      if (holder !== null) {
        const location =
          holder.mountId === null
            ? 'in another worktree of this project'
            : holder.label === null
              ? 'in another mount of this session'
              : `as ${holder.label} in this session`;
        return {
          title: `${projectName} is not on the branch it was left on`,
          description: `Expected ${recorded}, found ${found}. That branch is already mounted ${location}. Git keeps one branch in one worktree, so using it here would fail.`,
          notes: [
            `Use this branch here is turned off because ${found} is mounted elsewhere.`,
            RECHECK_NOTE,
            NOT_NOW_NOTE,
          ],
          confirm: {
            label: 'Use this branch here',
            resolution: 'adopt-observed',
            isDisabled: true,
          },
          alt: recheck({ isDisabled: false }),
        };
      }
      return {
        title: `${projectName} is not on the branch it was left on`,
        description: `Expected ${recorded}, found ${found}. Nothing was changed.`,
        notes: [
          `Use this branch here records ${found} as this mount's branch and leaves the directory alone.`,
          `Keep both branches records ${found} here, then mounts ${recorded} again in a row of its own.`,
          NOT_NOW_NOTE,
        ],
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
