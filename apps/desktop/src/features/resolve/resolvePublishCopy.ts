import type {
  PublicationBlocker,
  ResolvePublicationDrift,
  ResolvePublicationPreview,
} from '@goodboy/types';
import type { PublicationOutcome } from '../../store/slices/resolve/publicationOutcome';
import { closingThreadCount } from './closingThreadCount';
import type { ResolvePublishIntent } from './publishIntent';
import { formatClockTime } from '../../shared/utils/formatClockTime';

export type PublishCounts = Readonly<{
  commits: number;
  replies: number;
  notes: number;
}>;

const plural = ({
  count,
  one,
  many,
}: {
  readonly count: number;
  readonly one: string;
  readonly many: string;
}): string => `${count} ${count === 1 ? one : many}`;

export const REVIEW_PUBLICATION = 'Review publication';

export const PUBLISH_INTENT_LABEL: Record<ResolvePublishIntent, string> = {
  publish_fix: 'Push fix and resolve threads',
  close_without_fix: 'Resolve threads without the fix',
  post_replies: 'Post replies',
};

export const CLOSE_WITHOUT_FIX_CONFIRM = {
  title: 'Resolve threads without the fix',
  description:
    'No commit goes out with this batch. The reviewer threads read as resolved on the pull request and the code stays as it is.',
  confirmLabel: 'Resolve them anyway',
  cancelLabel: 'Keep them open',
} as const;

export const publishIntentSummary = ({
  preview,
}: {
  readonly preview: ResolvePublicationPreview;
}): string => {
  const closing = closingThreadCount({ preview });
  const counts = publicationCountsLine({ preview });
  const scope = `${plural({ count: closing, one: 'thread', many: 'threads' })} on #${preview.prNumber}`;
  return counts === null ? scope : `${counts}. ${scope}`;
};

export const publicationCountsLine = ({
  preview,
}: {
  readonly preview: ResolvePublicationPreview;
}): string | null => {
  const resolutions = closingThreadCount({ preview });
  const parts = [
    preview.commits.length === 0
      ? null
      : `${plural({ count: preview.commits.length, one: 'commit', many: 'commits' })} to push`,
    preview.replies.length === 0
      ? null
      : `${plural({ count: preview.replies.length, one: 'reply', many: 'replies' })} to post`,
    resolutions === 0
      ? null
      : `${plural({ count: resolutions, one: 'thread', many: 'threads' })} to resolve`,
  ].flatMap((part) => (part === null ? [] : [part]));
  return parts.length === 0 ? null : parts.join(' · ');
};

export const frozenAtLabel = ({ frozenAt }: { readonly frozenAt: number }): string =>
  `as of ${formatClockTime({ iso: frozenAt })}`;

export const HELD_BACK_REASON: Record<'comment_changed' | 'approval_withdrawn', string> = {
  comment_changed: 'the comment changed',
  approval_withdrawn: 'you took the approval back',
};

export const heldBackNote = ({
  preview,
}: {
  readonly preview: ResolvePublicationPreview;
}): string | null => {
  const held = preview.drift.filter((entry) => entry.threadId !== null);
  if (held.length === 0) {
    return null;
  }
  const reason =
    held[0]?.kind === 'approval_withdrawn'
      ? HELD_BACK_REASON.approval_withdrawn
      : HELD_BACK_REASON.comment_changed;
  return `${held.length} held back, ${reason}`;
};

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

export const UPDATE_AND_REVIEW = 'Update branch and review again';
export const CHECK_AND_RETRY = 'Check and retry';

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

export const heldBackChipLabel = ({
  kind,
}: {
  readonly kind: 'comment_changed' | 'approval_withdrawn';
}): string => `Held back, ${HELD_BACK_REASON[kind]}`;

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

const SHORT_SHA_LENGTH = 7;

export const publicationOutcomeSentence = ({
  outcome,
}: {
  readonly outcome: PublicationOutcome;
}): string => {
  const parts = [
    outcome.pushedHead === null ? null : `${outcome.pushedHead.slice(0, SHORT_SHA_LENGTH)} pushed`,
    outcome.replies === 0
      ? null
      : outcome.replied === outcome.replies
        ? `${plural({ count: outcome.replied, one: 'reply', many: 'replies' })} posted`
        : `${outcome.replied} of ${plural({ count: outcome.replies, one: 'reply', many: 'replies' })} posted`,
    outcome.resolved === 0
      ? null
      : `${plural({ count: outcome.resolved, one: 'thread', many: 'threads' })} resolved on GitHub`,
    outcome.leftOpen === 0 ? null : `${outcome.leftOpen} left open for the reviewer`,
  ].flatMap((part) => (part === null ? [] : [part]));
  const done = parts.length === 0 ? null : `${parts.join(', ')}.`;
  if (outcome.failed > 0) {
    const failure = `${outcome.failed} failed${outcome.error === null ? '' : `: ${outcome.error}`}.`;
    return done === null ? failure : `${done} ${failure}`;
  }
  if (outcome.total === 0 || outcome.resolved !== outcome.total) {
    return done ?? '';
  }
  const lead = `Closed ${outcome.total} on GitHub.`;
  return done === null ? lead : `${lead} ${done}`;
};
