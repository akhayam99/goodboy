import type { PrComment } from '@goodboy/types';

type Params = {
  readonly comments: ReadonlyArray<PrComment>;
  readonly ledger: ReadonlyArray<string>;
};

export const closedThreadIds = ({ comments, ledger }: Params): ReadonlySet<string> =>
  new Set([
    ...comments.flatMap((comment) =>
      comment.resolved === true && comment.threadId != null ? [comment.threadId] : [],
    ),
    ...ledger,
  ]);
