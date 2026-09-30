import type { PrComment } from '@goodboy/types';
import type { ReviewSourceThread } from './types';

type Params = Readonly<{
  comments: ReadonlyArray<PrComment>;
  providerThreadIdOf: (params: { readonly threadId: string }) => string;
}>;

export const groupReviewComments = ({
  comments,
  providerThreadIdOf,
}: Params): ReadonlyArray<ReviewSourceThread> => {
  const order: Array<string> = [];
  const groups = new Map<string, Array<PrComment>>();
  for (const comment of comments) {
    const threadId = comment.threadId;
    if (comment.source !== 'review' || threadId === undefined || threadId === '') {
      continue;
    }
    const group = groups.get(threadId);
    if (group === undefined) {
      groups.set(threadId, [comment]);
      order.push(threadId);
      continue;
    }
    group.push(comment);
  }
  return order.map((threadId) => {
    const sorted = [...(groups.get(threadId) ?? [])].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
    return {
      threadId,
      providerThreadId: providerThreadIdOf({ threadId }),
      isResolved: sorted[0]?.resolved === true,
      comments: sorted,
    };
  });
};
