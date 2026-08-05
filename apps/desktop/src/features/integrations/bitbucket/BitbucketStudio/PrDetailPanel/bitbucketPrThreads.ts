import type { BitbucketComment } from '../../client';

export type BitbucketPrThread = {
  readonly head: BitbucketComment;
  readonly replies: ReadonlyArray<BitbucketComment>;
};

type Params = {
  readonly comments: ReadonlyArray<BitbucketComment>;
};

export const bitbucketPrThreads = ({ comments }: Params): ReadonlyArray<BitbucketPrThread> => {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const rootIdOf = (comment: BitbucketComment): number => {
    let current = comment;
    let hops = 0;
    while (hops <= comments.length) {
      const parent = current.parentId == null ? null : (byId.get(current.parentId) ?? null);
      if (parent == null) {
        return current.id;
      }
      current = parent;
      hops += 1;
    }
    return current.id;
  };

  return comments
    .filter((comment) => rootIdOf(comment) === comment.id)
    .map((head) => ({
      head,
      replies: comments.filter(
        (comment) => comment.id !== head.id && rootIdOf(comment) === head.id,
      ),
    }));
};
