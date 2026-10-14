import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type { ResolveCommitStyle, ResolvePublicationPreview } from '@goodboy/types';
import type { PublicationOutcome } from '../../store/slices/resolve/publicationOutcome';
import { NAMES } from '../../shared/names';
import { openSettings } from '../settings/openSettings';
import { closingThreadCount } from './closingThreadCount';

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

const pushedCount = ({ preview }: { readonly preview: ResolvePublicationPreview }): number =>
  new Set([
    ...preview.replies.map((reply) => reply.threadId),
    ...preview.notes.map((note) => note.threadId),
  ]).size;

export const pushConfirmTitle = ({
  preview,
}: {
  readonly preview: ResolvePublicationPreview;
}): string => {
  const commits = preview.commits.length;
  if (commits > 0 && preview.requiresPush && preview.branch !== '') {
    return `Push ${plural(commits, 'commit', 'commits')} to ${preview.branch}?`;
  }
  const threads = pushedCount({ preview });
  return `Push ${plural(threads, 'comment', 'comments')} to #${preview.prNumber}?`;
};

const fixesPart = ({
  preview,
  commitStyle,
}: {
  readonly preview: ResolvePublicationPreview;
  readonly commitStyle: ResolveCommitStyle;
}): string => {
  const commits = preview.commits.length;
  if (commits === 0) {
    return 'No commit';
  }
  const fixes = new Set(preview.commits.flatMap((commit) => commit.threadIds)).size;
  const kind = commitStyle === 'fixup' ? 'fixup' : 'new';
  return `${plural(Math.max(fixes, 1), 'fix', 'fixes')} in ${commits} ${kind} ${commits === 1 ? 'commit' : 'commits'}`;
};

const closingPart = ({
  closing,
  provider,
  canResolve,
}: {
  readonly closing: number;
  readonly provider: string;
  readonly canResolve: boolean;
}): string =>
  canResolve
    ? `${plural(closing, 'thread', 'threads')} resolved on ${provider}`
    : `${plural(closing, 'thread', 'threads')} left open for the reviewer`;

export const pushConfirmBody = ({
  preview,
  commitStyle,
  provider = REVIEW_SOURCE_LABEL.github,
  canResolve = true,
}: {
  readonly preview: ResolvePublicationPreview;
  readonly commitStyle: ResolveCommitStyle;
  readonly provider?: string;
  readonly canResolve?: boolean;
}): string => {
  const closing = closingThreadCount({ preview });
  const parts = [
    fixesPart({ preview, commitStyle }),
    preview.replies.length === 0 ? null : plural(preview.replies.length, 'reply', 'replies'),
    closing === 0 ? null : closingPart({ closing, provider, canResolve }),
  ].flatMap((part) => (part === null ? [] : [part]));
  return `${parts.join(', ')}.`;
};

export const PUSH_TIP_LABEL = 'Tip';

export const earlierCommitsLine = ({ count }: { readonly count: number }): string =>
  `This also pushes ${count} earlier ${count === 1 ? 'commit' : 'commits'}`;

export type PushStyleNote = {
  readonly text: string;
  readonly linkLabel: string;
  readonly onOpen: () => void;
};

export const pushStyleNote = ({
  commitStyle,
}: {
  readonly commitStyle: ResolveCommitStyle;
}): PushStyleNote => ({
  text:
    commitStyle === 'fixup'
      ? 'Commits are fixups of the commits they fix, set in'
      : 'Every fix is its own new commit, set in',
  linkLabel: NAMES.repliesAndCommits,
  onOpen: () => openSettings({ scope: 'workspace', section: 'review-replies' }),
});

type PushResultTone = 'done' | 'partial' | 'failed';

export type PushResult = {
  readonly tone: PushResultTone;
  readonly sentence: string;
  readonly canSync?: boolean;
};

const shortSha = (sha: string): string => sha.slice(0, 7);

const capitalized = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export const pushResultOf = ({
  outcome,
  provider = REVIEW_SOURCE_LABEL.github,
  commits,
}: {
  readonly outcome: PublicationOutcome;
  readonly provider?: string;
  readonly commits?: number;
}): PushResult => {
  const landed = outcome.total - outcome.failed;
  const where = outcome.pushedHead === null ? '' : ` in ${shortSha(outcome.pushedHead)}`;
  if (outcome.failed > 0) {
    return {
      tone: landed === 0 ? 'failed' : 'partial',
      sentence: `${landed} of ${outcome.total} landed${where}. ${outcome.failed} did not: see ${outcome.failed === 1 ? 'the comment' : 'the comments'}.`,
    };
  }
  const lead = [
    outcome.pushedHead === null
      ? null
      : commits === undefined || commits === 0
        ? `pushed ${shortSha(outcome.pushedHead)}`
        : `pushed ${plural(commits, 'commit', 'commits')} to origin`,
    outcome.replied === 0
      ? null
      : `posted ${plural(outcome.replied, 'reply', 'replies')} on ${provider}`,
  ].flatMap((part) => (part === null ? [] : [part]));
  const tail = [
    outcome.resolved === 0 ? null : `${plural(outcome.resolved, 'thread', 'threads')} resolved.`,
    outcome.leftOpen === 0 ? null : `${outcome.leftOpen} left open for the reviewer.`,
  ].flatMap((part) => (part === null ? [] : [part]));
  const sentence = [lead.length === 0 ? null : `${capitalized(lead.join(' and '))}.`, ...tail]
    .flatMap((part) => (part === null ? [] : [part]))
    .join(' ');
  return {
    tone: 'done',
    sentence: sentence === '' ? 'Nothing needed to go out.' : sentence,
  };
};

export const PUSH_ONLY_LABEL = 'Push only this one';

export const PUSH_MISSING = 'The push was already handled or cancelled. Nothing changed.';

export const PUSH_STALE_FALLBACK = 'Something changed since the preview';

export const pushFixCount = ({
  preview,
}: {
  readonly preview: ResolvePublicationPreview;
}): number => pushedCount({ preview });

export const PUSH_BUSY = 'Another push is already running for this pull request.';

export const pushFailedSentence = ({ error }: { readonly error: string }): string =>
  `Nothing was pushed: ${error}. The comments stay as they were.`;
