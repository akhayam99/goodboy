import type { ResolveCommitStyle, ResolvePublicationPreview } from '@goodboy/types';
import type { PublicationOutcome } from '../../store/slices/resolve/publicationOutcome';
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
  const count = pushedCount({ preview });
  const where =
    preview.requiresPush && preview.branch !== '' ? preview.branch : `#${preview.prNumber}`;
  return `Push ${count} to ${where}?`;
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

export const pushConfirmBody = ({
  preview,
  commitStyle,
  provider = 'GitHub',
}: {
  readonly preview: ResolvePublicationPreview;
  readonly commitStyle: ResolveCommitStyle;
  readonly provider?: string;
}): string => {
  const closing = closingThreadCount({ preview });
  const parts = [
    fixesPart({ preview, commitStyle }),
    preview.replies.length === 0 ? null : plural(preview.replies.length, 'reply', 'replies'),
    closing === 0 ? null : `${plural(closing, 'thread', 'threads')} resolved on ${provider}`,
  ].flatMap((part) => (part === null ? [] : [part]));
  return `${parts.join(', ')}.`;
};

export const pushStyleNote = ({
  commitStyle,
}: {
  readonly commitStyle: ResolveCommitStyle;
}): string =>
  commitStyle === 'fixup'
    ? 'Commits are fixups of the commits they fix, set in Review replies.'
    : 'Every fix is its own new commit, set in Review replies.';

export type PushResultTone = 'done' | 'partial' | 'failed';

export type PushResult = {
  readonly tone: PushResultTone;
  readonly sentence: string;
};

const shortSha = (sha: string): string => sha.slice(0, 7);

export const pushResultOf = ({
  outcome,
  provider = 'GitHub',
}: {
  readonly outcome: PublicationOutcome;
  readonly provider?: string;
}): PushResult => {
  const landed = outcome.total - outcome.failed;
  const where = outcome.pushedHead === null ? '' : ` in ${shortSha(outcome.pushedHead)}`;
  if (outcome.failed > 0) {
    return {
      tone: landed === 0 ? 'failed' : 'partial',
      sentence: `${landed} of ${outcome.total} landed${where}. ${outcome.failed} did not: see ${outcome.failed === 1 ? 'the comment' : 'the comments'}.`,
    };
  }
  const parts = [
    outcome.pushedHead === null ? null : `Pushed ${shortSha(outcome.pushedHead)}`,
    outcome.replied === 0 ? null : `${plural(outcome.replied, 'reply', 'replies')} posted`,
    outcome.resolved === 0
      ? null
      : `${plural(outcome.resolved, 'thread', 'threads')} resolved on ${provider}`,
    outcome.leftOpen === 0 ? null : `${outcome.leftOpen} left open for the reviewer`,
  ].flatMap((part) => (part === null ? [] : [part]));
  return {
    tone: 'done',
    sentence: parts.length === 0 ? 'Nothing needed to go out.' : `${parts.join(', ')}.`,
  };
};

export const PUSH_BUSY = 'Another push is already running for this pull request.';

export const pushFailedSentence = ({ error }: { readonly error: string }): string =>
  `Nothing was pushed: ${error}. The comments stay as they were.`;
