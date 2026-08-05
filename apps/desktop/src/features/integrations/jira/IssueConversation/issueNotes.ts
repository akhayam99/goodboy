import type { JiraComment } from '../client';

type Params = {
  readonly comments: ReadonlyArray<JiraComment>;
};

export type JiraConversation = {
  readonly comments: ReadonlyArray<JiraComment>;
  readonly emptyCommentCount: number;
};

export const buildIssueConversation = ({ comments }: Params): JiraConversation => {
  const visible: JiraComment[] = [];
  let emptyCommentCount = 0;

  for (const comment of comments) {
    if (comment.body.trim() === '') {
      emptyCommentCount += 1;
      continue;
    }
    visible.push(comment);
  }

  return {
    comments: visible.sort((left, right) => left.created.localeCompare(right.created)),
    emptyCommentCount,
  };
};
