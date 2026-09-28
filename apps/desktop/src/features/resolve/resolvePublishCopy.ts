import type {
  PublicationBlocker,
  ResolvePublicationDrift,
  ResolvePublicationPreview,
} from '@goodboy/types';

const plural = ({
  count,
  one,
  many,
}: {
  readonly count: number;
  readonly one: string;
  readonly many: string;
}): string => `${count} ${count === 1 ? one : many}`;

export const excludedLine = ({
  preview,
}: {
  readonly preview: ResolvePublicationPreview;
}): string | null => {
  const count = preview.excluded.length;
  if (count === 0) {
    return null;
  }
  return `${plural({ count, one: 'comment', many: 'comments' })} ${count === 1 ? 'needs' : 'need'} you first`;
};

export const driftSentence = ({
  drift,
}: {
  readonly drift: ReadonlyArray<ResolvePublicationDrift>;
}): string | null => {
  const mount = drift.find((entry) => entry.kind === 'mount_changed');
  if (mount !== undefined) {
    return `The destination moved from ${mount.before} to ${mount.after}`;
  }
  const branch = drift.find((entry) => entry.kind === 'branch_moved');
  if (branch !== undefined) {
    return `The branch moved from ${branch.before} to ${branch.after}`;
  }
  const remote = drift.find((entry) => entry.kind === 'remote_moved');
  if (remote !== undefined) {
    return `The remote moved from ${remote.before} to ${remote.after}`;
  }
  if (drift.every((entry) => entry.threadId !== null)) {
    return null;
  }
  return drift.length === 0 ? null : 'Something changed while you were looking';
};

export type BlockerCopy = {
  readonly sentence: string;
  readonly action: 'open_diff' | 'view_work' | 'recheck_fix' | 'refresh' | null;
};

export const blockerCopy = ({
  blocker,
  prNumber,
}: {
  readonly blocker: PublicationBlocker;
  readonly prNumber: number;
}): BlockerCopy => {
  switch (blocker) {
    case 'uncaptured_work':
      return { sentence: 'The branch carries work nobody approved', action: 'view_work' };
    case 'unapproved_commit':
      return { sentence: 'The branch carries a commit you did not approve', action: 'view_work' };
    case 'dirty_tree':
      return { sentence: 'Worktree has uncommitted changes', action: 'open_diff' };
    case 'writer_busy':
      return { sentence: 'A fix is still running on this worktree', action: 'view_work' };
    case 'publication_in_progress':
      return { sentence: `Another push is already running for #${prNumber}`, action: null };
    case 'missing_commit':
      return { sentence: 'Fix changed since review', action: 'recheck_fix' };
    case 'remote_moved':
      return { sentence: 'The remote moved', action: 'refresh' };
    case 'no_branch':
      return { sentence: 'This session has no branch to push', action: null };
    case 'no_target':
      return { sentence: 'Add the project to this session first', action: null };
    default: {
      const never: never = blocker;
      return { sentence: never, action: null };
    }
  }
};
