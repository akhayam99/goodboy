import type { PrComment } from '@goodboy/types';
import type { ResolverIndex } from '../resolver-linkage';
import { resolverForComment } from '../resolver-linkage';

type Params = {
  readonly comments: ReadonlyArray<PrComment>;
  readonly resolverIndex: ResolverIndex;
};

export const openPrThreads = ({ comments, resolverIndex }: Params): ReadonlyArray<PrComment> => {
  const heads = new Map<string, PrComment>();
  for (const comment of comments) {
    if (comment.source !== 'review') {
      continue;
    }
    if (comment.resolved === true || comment.outdated === true) {
      continue;
    }
    if (comment.inReplyToId != null) {
      continue;
    }
    if (comment.threadId == null) {
      continue;
    }
    if (heads.has(comment.threadId)) {
      continue;
    }
    heads.set(comment.threadId, comment);
  }
  return [...heads.values()].filter((comment) => {
    const link = resolverForComment(resolverIndex, {
      threadId: comment.threadId,
      url: comment.url,
    });
    if (link === undefined) {
      return true;
    }
    return link.status === 'failed';
  });
};
