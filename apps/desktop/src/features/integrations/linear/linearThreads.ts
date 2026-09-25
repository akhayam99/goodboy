import type { LinearIssueComment } from './client';

export type LinearThread = {
  readonly head: LinearIssueComment;
  readonly replies: ReadonlyArray<LinearIssueComment>;
};

type Params = {
  readonly comments: ReadonlyArray<LinearIssueComment>;
};

const byCreatedAt = (left: LinearIssueComment, right: LinearIssueComment): number =>
  left.createdAt.localeCompare(right.createdAt);

export const linearThreads = ({ comments }: Params): ReadonlyArray<LinearThread> => {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const rootIdOf = (comment: LinearIssueComment): string => {
    let current = comment;
    let hops = 0;
    while (hops <= comments.length) {
      const parent = current.parent == null ? null : (byId.get(current.parent.id) ?? null);
      if (parent == null) {
        return current.id;
      }
      current = parent;
      hops += 1;
    }
    return current.id;
  };

  const ordered = [...comments].sort(byCreatedAt);
  return ordered
    .filter((comment) => rootIdOf(comment) === comment.id)
    .map((head) => ({
      head,
      replies: ordered.filter((comment) => comment.id !== head.id && rootIdOf(comment) === head.id),
    }));
};
