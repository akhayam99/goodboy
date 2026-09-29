import type { PrComment, ResolveSourceSnapshot } from '@goodboy/types';

export type ReviewSourceChange = {
  readonly before: string;
  readonly after: string;
  readonly author: string | null;
  readonly seenAt: number;
};

export const sourceChangeOf = ({
  snapshot,
}: {
  readonly snapshot: ResolveSourceSnapshot | undefined;
}): ReviewSourceChange | null =>
  snapshot?.changed == null
    ? null
    : {
        before: snapshot.body,
        after: snapshot.changed.body,
        author: snapshot.changed.author,
        seenAt: snapshot.changed.seenAt,
      };

export const newRepliesOf = ({
  snapshot,
  replies,
}: {
  readonly snapshot: ResolveSourceSnapshot | undefined;
  readonly replies: ReadonlyArray<PrComment>;
}): ReadonlyArray<PrComment> =>
  snapshot === undefined ? [] : replies.filter((reply) => !snapshot.replyIds.includes(reply.id));
