import type { PrComment, ResolveSourceSnapshot, ResolveThread } from '@goodboy/types';
import { groupThreads } from '../../../features/integrations/github/comment-threads';

type TextParams = {
  readonly comments: ReadonlyArray<PrComment>;
  readonly threadId: string;
};

export type SourceText = {
  readonly body: string;
  readonly author: string | null;
  readonly replyIds: ReadonlyArray<string>;
};

export const sourceTextOf = ({ comments, threadId }: TextParams): SourceText | null => {
  const thread = groupThreads(
    comments.filter((comment) => comment.threadId === threadId && comment.source === 'review'),
  )[0];
  if (thread === undefined) {
    return null;
  }
  return {
    body: thread.head.body,
    author: thread.head.author,
    replyIds: thread.replies.map((reply) => reply.id),
  };
};

type NextParams = {
  readonly previous: ResolveSourceSnapshot | null;
  readonly stage: ResolveThread['stage'];
  readonly fingerprint: string;
  readonly source: SourceText;
  readonly now: number;
};

const sameIds = ({
  left,
  right,
}: {
  readonly left: ReadonlyArray<string>;
  readonly right: ReadonlyArray<string>;
}): boolean => left.length === right.length && left.every((id, index) => id === right[index]);

export const baselineSnapshot = ({
  fingerprint,
  source,
  now,
}: Pick<NextParams, 'fingerprint' | 'source' | 'now'>): ResolveSourceSnapshot => ({
  body: source.body,
  author: source.author,
  fingerprint,
  seenAt: now,
  replyIds: source.replyIds,
  changed: null,
});

export const nextSourceSnapshot = ({
  previous,
  stage,
  fingerprint,
  source,
  now,
}: NextParams): ResolveSourceSnapshot | null => {
  if (previous === null) {
    return baselineSnapshot({ fingerprint, source, now });
  }
  if (stage === 'new') {
    const isSame =
      previous.fingerprint === fingerprint &&
      previous.changed === null &&
      sameIds({ left: previous.replyIds, right: source.replyIds });
    return isSame ? null : baselineSnapshot({ fingerprint, source, now });
  }
  if (previous.fingerprint === fingerprint) {
    return previous.changed === null ? null : { ...previous, changed: null };
  }
  if (previous.changed?.fingerprint === fingerprint) {
    return null;
  }
  return {
    ...previous,
    changed: { body: source.body, author: source.author, fingerprint, seenAt: now },
  };
};
