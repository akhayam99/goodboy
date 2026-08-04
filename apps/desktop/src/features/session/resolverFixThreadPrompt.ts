type Params = {
  readonly threadId: string;
};

export const resolverFixThreadPrompt = ({ threadId }: Params): string =>
  [
    `Closing review thread ${threadId} without a change is not accepted.`,
    'Implement the change that thread asks for and commit it.',
    `Finish with a fresh <<comment-resolved threadId="${threadId}" commitSha="...">> marker for that thread id,`,
    `followed by <<comment-reply threadId="${threadId}">>the reply to post on it<</comment-reply>>.`,
    'Leave every other thread you own untouched.',
  ].join(' ');
