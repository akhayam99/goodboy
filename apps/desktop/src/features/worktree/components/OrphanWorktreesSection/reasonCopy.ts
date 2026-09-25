import type { WorktreeRemovalReason } from '@goodboy/types';

const CHANGE_REASONS: ReadonlyArray<WorktreeRemovalReason> = [
  'staged-changes',
  'unstaged-changes',
  'untracked-files',
];

const FORCEABLE_REASONS: ReadonlyArray<WorktreeRemovalReason> = [
  ...CHANGE_REASONS,
  'not-registered',
];

const REASON_COPY: ReadonlyArray<readonly [WorktreeRemovalReason, string]> = [
  ['writer-lease-held', 'An agent is writing here'],
  ['operation-in-progress', 'A git operation is in progress'],
  ['unmerged-conflicts', 'Has unresolved conflicts'],
  ['staged-changes', 'Has changes not committed'],
  ['unstaged-changes', 'Has changes not committed'],
  ['untracked-files', 'Has changes not committed'],
  ['not-registered', "Git doesn't track this folder"],
  ['locked', 'Locked by git'],
  ['outside-worktree-folder', 'Outside the Goodboy worktrees folder'],
  ['different-repository', 'Belongs to another repository'],
  ['unexpected-directory', 'Not a Goodboy worktree'],
  ['main-checkout', 'This is the main checkout'],
  ['repository-unavailable', "Couldn't open the repository"],
  ['status-unavailable', "Couldn't read its git status"],
];

type ReasonsParams = {
  readonly reasons: ReadonlyArray<WorktreeRemovalReason>;
};

type WarningParams = ReasonsParams & {
  readonly size: string;
};

export const keptReasonLabel = ({ reasons }: ReasonsParams): string => {
  const match = REASON_COPY.find(([reason]) => reasons.includes(reason));
  return match === undefined ? 'Kept on disk' : match[1];
};

export const canForceRemoval = ({ reasons }: ReasonsParams): boolean =>
  reasons.length > 0 && reasons.every((reason) => FORCEABLE_REASONS.includes(reason));

export const forceRemovalWarning = ({ reasons, size }: WarningParams): string => {
  if (reasons.some((reason) => CHANGE_REASONS.includes(reason))) {
    return `Changes not committed in this folder will be lost, ${size} in all. The branch stays.`;
  }
  return `Goodboy can't check this folder for changes. ${size} will be removed from disk.`;
};
